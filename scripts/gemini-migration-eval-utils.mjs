import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  chmod,
  lstat,
  link,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  buildThinkingConfig,
  listEvaluationConfigurations,
} from '../services/geminiConfig.js';

export const ALL_CONFIGURATION_IDS = Object.freeze([
  'gemini-2.5-flash-baseline',
  'gemini-3.5-flash-lite-minimal',
  'gemini-3.6-flash-minimal',
  'gemini-3.6-flash-medium',
]);

export const CANONICAL_SPEND_LEDGER_RELATIVE_PATH = 'evals/results/gemini-migration/phase-3-spend.json';
export const NANO_USD_PER_USD = 1_000_000_000;
export const MIGRATION_TOKEN_LIMITS = Object.freeze({
  generation: Object.freeze({ maxInputTokens: 32_768, maxOutputTokens: 1_024 }),
  evaluation: Object.freeze({ maxInputTokens: 65_536, maxOutputTokens: 4_096 }),
});

const SPEND_TYPES = new Set(['generation', 'evaluation']);
const RECOVERY_REASON_CODES = new Set([
  'provider-outcome-unknown',
  'checkpoint-damaged',
  'settlement-interrupted',
]);
const providerDurations = new WeakMap();
const registry = listEvaluationConfigurations();
const registryById = new Map(registry.map((configuration) => [configuration.id, configuration]));

if (registry.length !== ALL_CONFIGURATION_IDS.length
  || ALL_CONFIGURATION_IDS.some((id, index) => registry[index]?.id !== id)) {
  throw new Error('Gemini migration evaluation registry must contain exactly the four approved configurations.');
}

function roundUsd(value) {
  return Number(Number(value).toFixed(6));
}

function requireFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite non-negative number.`);
  }
  return value;
}

export function selectConfigurations(rawSelection) {
  if (typeof rawSelection !== 'string' || !rawSelection.trim()) {
    throw new Error('An explicit Gemini migration configuration or configuration list is required.');
  }

  const ids = rawSelection.trim() === 'all'
    ? [...ALL_CONFIGURATION_IDS]
    : rawSelection.split(',').map((value) => value.trim()).filter(Boolean);
  const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicate) {
    throw new Error(`Duplicate Gemini migration configuration: ${duplicate}`);
  }
  const unknown = ids.filter((id) => !registryById.has(id));
  if (unknown.length) {
    throw new Error(`Unknown Gemini migration configuration(s): ${unknown.join(', ')}`);
  }

  return ids.map((id) => registryById.get(id));
}

export function captureConfigurationMetadata(configuration) {
  if (!registryById.has(configuration?.id)) {
    throw new Error(`Unknown Gemini migration configuration: ${configuration?.id ?? 'missing'}`);
  }
  return {
    id: configuration.id,
    model: configuration.model,
    thinkingConfig: buildThinkingConfig(configuration),
    inputUsdPerMillion: configuration.inputUsdPerMillion,
    outputUsdPerMillion: configuration.outputUsdPerMillion,
    pricingVerifiedOn: configuration.pricingVerifiedOn,
    pricingNote: configuration.pricingNote,
    productionAllowed: configuration.productionAllowed,
  };
}

export function calculateUsageCost(configuration, usageMetadata) {
  return nanoUsdToUsd(calculateUsageCostNanoUsd(configuration, usageMetadata));
}

function configuredNanoUsdPerToken(usdPerMillion, label) {
  const nanoUsdPerToken = usdPerMillion * 1_000;
  if (!Number.isSafeInteger(nanoUsdPerToken) || nanoUsdPerToken < 0) {
    throw new Error(`${label} must resolve exactly to integer nano-USD per token.`);
  }
  return nanoUsdPerToken;
}

export function usdToNanoUsdCeil(value) {
  requireFiniteNonNegative(value, 'USD amount');
  if (value === 0) return 0;
  const units = Math.ceil(value * NANO_USD_PER_USD);
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new Error('USD amount does not fit safe integer nano-USD accounting.');
  }
  return units;
}

export function nanoUsdToUsd(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('Nano-USD amount must be a safe non-negative integer.');
  }
  return value / NANO_USD_PER_USD;
}

export function calculateUsageCostNanoUsd(configuration, usageMetadata) {
  const promptTokens = usageMetadata?.promptTokenCount ?? 0;
  const visibleCandidateTokens = usageMetadata?.candidatesTokenCount ?? 0;
  const thoughtTokens = usageMetadata?.thoughtsTokenCount ?? 0;
  for (const [label, value] of [
    ['prompt tokens', promptTokens],
    ['visible candidate tokens', visibleCandidateTokens],
    ['thought tokens', thoughtTokens],
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  }
  const inputRate = configuredNanoUsdPerToken(configuration.inputUsdPerMillion, 'Input price');
  const outputRate = configuredNanoUsdPerToken(configuration.outputUsdPerMillion, 'Output price');
  const cost = (promptTokens * inputRate) + ((visibleCandidateTokens + thoughtTokens) * outputRate);
  if (!Number.isSafeInteger(cost) || cost < 0) throw new Error('Usage cost exceeds safe nano-USD accounting.');
  return cost;
}

function sourceItems(payload, sourcePath) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  throw new Error(`Migration corpus source ${sourcePath} must be an array or contain an items array.`);
}

function provenance(source, stableId) {
  return { source, stableId };
}

export async function loadMigrationCorpus(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.imports) || !Array.isArray(manifest.cases)) {
    throw new Error('Migration corpus manifest must define imports and cases arrays.');
  }
  const repoRoot = path.resolve(path.dirname(manifestPath), '..');
  const casesById = new Map();
  const imports = [];
  let importedCount = 0;

  const addCase = (rawCase, source, defaults = {}) => {
    if (!rawCase?.id) throw new Error(`Migration corpus case from ${source} is missing a stable id.`);
    const existing = casesById.get(rawCase.id);
    if (existing) {
      existing.provenance.push(provenance(source, rawCase.id));
      return;
    }
    casesById.set(rawCase.id, {
      ...defaults,
      ...rawCase,
      provenance: [provenance(source, rawCase.id)],
    });
  };

  for (const source of manifest.imports) {
    const absolutePath = path.resolve(repoRoot, source.path);
    const items = sourceItems(JSON.parse(await readFile(absolutePath, 'utf8')), source.path);
    imports.push({ path: source.path, importedCount: items.length });
    importedCount += items.length;
    for (const item of items) {
      addCase(item, source.path, {
        operation: source.operation ?? 'translation',
        rounds: source.rounds,
        variationDirections: source.variationDirections,
      });
    }
  }

  for (const item of manifest.cases) {
    addCase(item, 'evals/gemini-migration-prompt-set.json', { operation: 'translation' });
  }

  const localOnlyIds = new Set(manifest.localOnlyCaseIds ?? []);
  for (const id of localOnlyIds) {
    const item = casesById.get(id);
    if (!item) throw new Error(`Local-only migration case does not exist: ${id}`);
    item.localOnly = true;
  }

  return {
    schemaVersion: manifest.schemaVersion,
    seed: manifest.seed,
    imports,
    importedCount,
    cases: [...casesById.values()],
  };
}

function hashSeed(seed) {
  let state = 2166136261;
  for (const character of String(seed)) {
    state ^= character.codePointAt(0);
    state = Math.imul(state, 16777619);
  }
  return state >>> 0;
}

function seededRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function seededShuffle(items, seed) {
  const shuffled = [...items];
  const random = seededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function callsForGroup({ testCase, configuration, repeat }) {
  const base = {
    caseId: testCase.id,
    operation: testCase.operation ?? 'translation',
    configurationId: configuration.id,
    repeat,
  };
  if (base.operation === 'moreIdeas') {
    const rounds = Number.isInteger(testCase.rounds) && testCase.rounds > 0 ? testCase.rounds : 3;
    return Array.from({ length: rounds }, (_, index) => ({
      ...base,
      round: index + 1,
      runId: `${configuration.id}:${testCase.id}:repeat-${repeat}:round-${index + 1}`,
    }));
  }
  if (base.operation === 'variation') {
    const directions = testCase.variationDirections ?? [];
    return directions.map((variationKind) => ({
      ...base,
      variationKind,
      runId: `${configuration.id}:${testCase.id}:repeat-${repeat}:${variationKind}`,
    }));
  }
  return [{
    ...base,
    runId: `${configuration.id}:${testCase.id}:repeat-${repeat}`,
  }];
}

export function buildEvaluationPlan({ cases, configurations, repeats = 1, seed = 1 }) {
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error('Migration evaluation repeats must be a positive integer.');
  }
  const remoteCases = cases.filter((item) => !item.localOnly);
  const localChecks = cases.filter((item) => item.localOnly).map((item) => ({
    caseId: item.id,
    operation: item.operation ?? 'translation',
    localOnly: true,
    status: 'not-called',
  }));
  const groups = [];
  for (const configuration of configurations) {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      for (const testCase of remoteCases) {
        groups.push({ testCase, configuration, repeat });
      }
    }
  }
  const calls = seededShuffle(groups, seed).flatMap(callsForGroup);
  return { seed, repeats, calls, localChecks };
}

export function buildArtifactPaths({ resultsDir, baseName, now = new Date() }) {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return {
    json: path.join(resultsDir, `${baseName}-${timestamp}.json`),
    markdown: path.join(resultsDir, `${baseName}-${timestamp}.md`),
    latestJson: path.join(resultsDir, `latest-${baseName}.json`),
    latestMarkdown: path.join(resultsDir, `latest-${baseName}.md`),
  };
}

function requireSafeNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a safe non-negative integer.`);
  }
  return value;
}

function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical request identity cannot contain non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new Error(`Canonical request identity cannot contain ${typeof value} values.`);
}

export function hashCanonicalValue(value) {
  return crypto.createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function buildRequestIdentityHash({ type, runId, configuration, request, requestContext }) {
  if (!SPEND_TYPES.has(type)) throw new Error(`Unknown Phase 3 spend type: ${type}`);
  if (typeof runId !== 'string' || !runId) throw new Error('A stable logical call ID is required.');
  if (!configuration?.id || !configuration?.model) throw new Error('Exact request configuration metadata is required.');
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('The effective request is required.');
  if (request.model !== configuration.model) {
    throw new Error(`Effective request model ${request.model ?? 'missing'} does not match configuration model ${configuration.model}.`);
  }
  if (!requestContext || typeof requestContext !== 'object' || Array.isArray(requestContext)
    || Object.keys(requestContext).length === 0) {
    throw new Error('Explicit request context is required for stable request identity.');
  }
  for (const field of [
    'harnessVersion',
    'schemaVersion',
    'corpusSourceIdentity',
    'repeat',
    'direction',
    'moreIdeasRound',
    'operation',
  ]) {
    if (!Object.hasOwn(requestContext, field) || requestContext[field] === undefined) {
      throw new Error(`Request identity requires ${field}.`);
    }
  }
  if (type === 'evaluation' && !requestContext.evaluatorVersion) {
    throw new Error('Evaluation request identity requires evaluatorVersion.');
  }
  if (!Number.isInteger(requestContext.repeat) || requestContext.repeat < 1) {
    throw new Error('Request identity repeat must be a positive integer.');
  }
  if (requestContext.moreIdeasRound !== null
    && (!Number.isInteger(requestContext.moreIdeasRound) || requestContext.moreIdeasRound < 1)) {
    throw new Error('Request identity More Ideas round must be null or a positive integer.');
  }
  return hashCanonicalValue({
    identitySchemaVersion: 1,
    type,
    stableLogicalId: runId,
    configuration: captureConfigurationMetadata(configuration),
    effectiveRequest: request,
    requestContext,
  });
}

function bindProviderDuration(result, durationMs) {
  if (result && (typeof result === 'object' || typeof result === 'function')) {
    providerDurations.set(result, durationMs);
  }
  return result;
}

export function getProviderDurationMs(result) {
  const durationMs = result && (typeof result === 'object' || typeof result === 'function')
    ? providerDurations.get(result)
    : undefined;
  if (!Number.isSafeInteger(durationMs) || durationMs < 0) {
    throw new Error('Provider duration metadata is unavailable for this result.');
  }
  return durationMs;
}

function expectedBudgetNanoUsd(budgetUsd) {
  const units = budgetUsd * NANO_USD_PER_USD;
  if (!Number.isSafeInteger(units) || units <= 0) {
    throw new Error('Phase 3 budget must resolve exactly to positive integer nano-USD.');
  }
  return units;
}

function validateUsageMetadata(usageMetadata, label) {
  if (!usageMetadata || typeof usageMetadata !== 'object') throw new Error(`Invalid ${label} usage metadata.`);
  for (const key of ['promptTokenCount', 'candidatesTokenCount', 'thoughtsTokenCount']) {
    requireSafeNonNegativeInteger(usageMetadata[key], `${label} ${key}`);
  }
}

function validateLedger(ledger, budgetUsd) {
  if (ledger?.schemaVersion !== 4 || ledger.phase !== 'gemini-model-migration-phase-3'
    || ledger.currency !== 'USD' || ledger.unit !== 'nano-usd') {
    throw new Error('Invalid Phase 3 spend ledger schema.');
  }
  const budgetNanoUsd = expectedBudgetNanoUsd(budgetUsd);
  if (ledger.budgetNanoUsd !== budgetNanoUsd) {
    throw new Error(`Phase 3 spend ledger budget is ${ledger.budgetNanoUsd} nano-USD, not requested ${budgetNanoUsd}.`);
  }
  for (const type of SPEND_TYPES) {
    if (!Number.isInteger(ledger[type]?.calls) || ledger[type].calls < 0) {
      throw new Error(`Invalid ${type} call count in Phase 3 spend ledger.`);
    }
    requireSafeNonNegativeInteger(ledger[type]?.spendNanoUsd, `${type} spend`);
  }
  requireSafeNonNegativeInteger(ledger.totalSpendNanoUsd, 'total spend');
  requireSafeNonNegativeInteger(ledger.reservedNanoUsd, 'reserved spend');
  if (!Array.isArray(ledger.pendingReservations)) {
    throw new Error('Invalid Phase 3 pending reservations.');
  }
  if (!ledger.completedCalls || typeof ledger.completedCalls !== 'object' || Array.isArray(ledger.completedCalls)) {
    throw new Error('Invalid Phase 3 completed-call journal.');
  }
  if (!Array.isArray(ledger.recoveryActions)) {
    throw new Error('Invalid Phase 3 recovery audit trail.');
  }
  const componentSpend = ledger.generation.spendNanoUsd + ledger.evaluation.spendNanoUsd;
  if (!Number.isSafeInteger(componentSpend) || ledger.totalSpendNanoUsd !== componentSpend) {
    throw new Error(`Invalid Phase 3 accounting: total spend does not equal component sums (${componentSpend}).`);
  }
  const pendingCallIds = new Set();
  const pendingLiabilities = ledger.pendingReservations.reduce((total, reservation) => {
    if (!reservation?.id || !reservation.callId || !reservation.runId || !SPEND_TYPES.has(reservation.type)) {
      throw new Error('Invalid Phase 3 pending reservation identity or type.');
    }
    if (reservation.callId !== `${reservation.type}:${reservation.runId}` || pendingCallIds.has(reservation.callId)) {
      throw new Error('Invalid or duplicate Phase 3 pending stable call ID.');
    }
    pendingCallIds.add(reservation.callId);
    if (!/^[a-f0-9]{64}$/.test(reservation.requestHash ?? '')) {
      throw new Error('Invalid Phase 3 pending request hash.');
    }
    if (!['reserved', 'dispatched', 'unresolved'].includes(reservation.status)) {
      throw new Error(`Invalid Phase 3 pending reservation status: ${reservation.status}`);
    }
    requireSafeNonNegativeInteger(reservation.liabilityNanoUsd, 'pending liability');
    if (!Number.isInteger(reservation.ownerPid) || !reservation.ownerToken || !reservation.createdAt) {
      throw new Error('Invalid Phase 3 pending reservation owner metadata.');
    }
    if (reservation.status !== 'reserved' && !reservation.dispatchedAt) {
      throw new Error('Invalid Phase 3 dispatched reservation timestamp.');
    }
    const next = total + reservation.liabilityNanoUsd;
    if (!Number.isSafeInteger(next)) throw new Error('Pending liabilities exceed safe integer accounting.');
    return next;
  }, 0);
  if (ledger.reservedNanoUsd !== pendingLiabilities) {
    throw new Error(`Invalid Phase 3 accounting: reserved spend does not equal pending liabilities (${pendingLiabilities}).`);
  }
  const completedTotals = {
    generation: { calls: 0, spendNanoUsd: 0 },
    evaluation: { calls: 0, spendNanoUsd: 0 },
  };
  for (const [callId, completed] of Object.entries(ledger.completedCalls)) {
    if (completed?.callId !== callId || completed.callId !== `${completed.type}:${completed.runId}`
      || !SPEND_TYPES.has(completed.type) || pendingCallIds.has(callId)) {
      throw new Error('Invalid or conflicting completed stable call ID.');
    }
    requireSafeNonNegativeInteger(completed.spendNanoUsd, 'completed call spend');
    requireSafeNonNegativeInteger(completed.liabilityNanoUsd, 'completed call liability');
    if (completed.spendNanoUsd > completed.liabilityNanoUsd) {
      throw new Error('Invalid completed call accounting: spend exceeds reserved liability.');
    }
    if (completed.providerDurationMs !== null) {
      requireSafeNonNegativeInteger(completed.providerDurationMs, 'completed call provider duration');
    }
    validateUsageMetadata(completed.usageMetadata, 'completed call');
    const validReplayableResult = completed.resultAvailable === true
      && completed.resolution === 'provider_response'
      && typeof completed.resultCheckpoint?.relativePath === 'string'
      && /^\.call-checkpoints\/[a-f0-9]{64}\.json$/.test(completed.resultCheckpoint.relativePath)
      && /^[a-f0-9]{64}$/.test(completed.resultCheckpoint.sha256);
    const validRecoveredResult = completed.resultAvailable === false
      && completed.resolution === 'operator-settled-upper-bound'
      && completed.resultCheckpoint === null;
    if (!completed.configurationId || !completed.completedAt
      || !/^[a-f0-9]{64}$/.test(completed.requestHash ?? '')
      || (!validReplayableResult && !validRecoveredResult)) {
      throw new Error('Invalid completed call metadata or result checkpoint reference.');
    }
    completedTotals[completed.type].calls += 1;
    completedTotals[completed.type].spendNanoUsd += completed.spendNanoUsd;
  }
  for (const type of SPEND_TYPES) {
    if (ledger[type].calls !== completedTotals[type].calls
      || ledger[type].spendNanoUsd !== completedTotals[type].spendNanoUsd) {
      throw new Error(`Invalid ${type} accounting: settled totals do not match completed-call journal.`);
    }
  }
  const recoveryIds = new Set();
  for (const action of ledger.recoveryActions) {
    if (!action?.actionId || recoveryIds.has(action.actionId)
      || !ledger.completedCalls[action.originalCallId]
      || action.originalRequestHash !== ledger.completedCalls[action.originalCallId].requestHash
      || !RECOVERY_REASON_CODES.has(action.reasonCode)
      || !/^[A-Za-z0-9._-]{1,64}$/.test(action.operatorId ?? '')
      || !action.resolvedAt || !action.retryRunId || !action.retryCallId
      || action.retryCallId !== `${ledger.completedCalls[action.originalCallId].type}:${action.retryRunId}`
      || !Number.isInteger(action.retryAttempt) || action.retryAttempt < 1
      || (action.retryRequestHash !== null && !/^[a-f0-9]{64}$/.test(action.retryRequestHash))) {
      throw new Error('Invalid Phase 3 recovery audit metadata.');
    }
    requireSafeNonNegativeInteger(action.settledNanoUsd, 'recovery settled spend');
    recoveryIds.add(action.actionId);
  }
  if (ledger.totalSpendNanoUsd + ledger.reservedNanoUsd > ledger.budgetNanoUsd) {
    throw new Error('Invalid Phase 3 accounting: spend plus liabilities exceeds the budget.');
  }
  const hasActivity = ledger.totalSpendNanoUsd > 0 || ledger.reservedNanoUsd > 0
    || ledger.generation.calls > 0 || ledger.evaluation.calls > 0;
  if (hasActivity && !ledger.updatedAt) {
    throw new Error('Invalid Phase 3 accounting: updatedAt is required after activity.');
  }
  return ledger;
}

function integerZeroLedger(budgetNanoUsd) {
  return {
    schemaVersion: 4,
    phase: 'gemini-model-migration-phase-3',
    currency: 'USD',
    unit: 'nano-usd',
    budgetNanoUsd,
    generation: { calls: 0, spendNanoUsd: 0 },
    evaluation: { calls: 0, spendNanoUsd: 0 },
    totalSpendNanoUsd: 0,
    reservedNanoUsd: 0,
    pendingReservations: [],
    completedCalls: {},
    recoveryActions: [],
    updatedAt: null,
  };
}

function migrateCommittedZeroLedger(ledger, budgetUsd) {
  const expectedLegacy = {
    schemaVersion: 3,
    phase: 'gemini-model-migration-phase-3',
    currency: 'USD',
    unit: 'nano-usd',
    budgetNanoUsd: 10_000_000_000,
    generation: { calls: 0, spendNanoUsd: 0 },
    evaluation: { calls: 0, spendNanoUsd: 0 },
    totalSpendNanoUsd: 0,
    reservedNanoUsd: 0,
    pendingReservations: [],
    completedCalls: {},
    updatedAt: null,
  };
  if (JSON.stringify(ledger) !== JSON.stringify(expectedLegacy) || budgetUsd !== 10) return null;
  return integerZeroLedger(expectedBudgetNanoUsd(budgetUsd));
}

export async function resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath } = {}) {
  if (!repoRoot) throw new Error('Repository root is required for the canonical Phase 3 spend ledger.');
  const canonicalPath = path.resolve(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  const suppliedPath = path.resolve(repoRoot, requestedPath ?? ledgerPath ?? CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  if (suppliedPath !== canonicalPath) {
    throw new Error(`Only the canonical Phase 3 spend ledger is allowed: ${canonicalPath}`);
  }
  const fileStats = await lstat(canonicalPath);
  if (fileStats.isSymbolicLink()) {
    throw new Error('The canonical Phase 3 spend ledger must not be a symlink.');
  }
  const resolvedRealPath = await realpath(canonicalPath);
  const expectedRealPath = path.resolve(await realpath(repoRoot), CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  if (resolvedRealPath !== expectedRealPath) {
    throw new Error('The canonical Phase 3 spend ledger path must not contain symlink aliases.');
  }
  return canonicalPath;
}

export async function readSpendLedger({ repoRoot, requestedPath, ledgerPath, budgetUsd = 10 }) {
  const canonicalPath = await resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath });
  return withLedgerLock(canonicalPath, () => readLedgerAtCanonicalPath(canonicalPath, budgetUsd));
}

async function ensurePrivateDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  const directoryStats = await lstat(directoryPath);
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    throw new Error('Private checkpoint parent must be a real directory.');
  }
  await chmod(directoryPath, 0o700);
}

async function atomicWriteJson(filePath, value, { privateFile = false } = {}) {
  if (privateFile) {
    await ensurePrivateDirectory(path.dirname(filePath));
  } else {
    await mkdir(path.dirname(filePath), { recursive: true });
  }
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = await open(temporaryPath, 'wx', privateFile ? 0o600 : 0o666);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, filePath);
}

async function writePrivateCallCheckpoint({ repoRoot, callId, requestHash, result }) {
  const migrationResultsDir = path.resolve(repoRoot, path.dirname(CANONICAL_SPEND_LEDGER_RELATIVE_PATH));
  const checkpointDirectory = path.join(migrationResultsDir, '.call-checkpoints');
  await ensurePrivateDirectory(checkpointDirectory);
  const directoryStats = await lstat(checkpointDirectory);
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    throw new Error('The canonical call-checkpoint directory must be a private real directory.');
  }
  const expectedRealDirectory = path.join(
    await realpath(repoRoot),
    path.dirname(CANONICAL_SPEND_LEDGER_RELATIVE_PATH),
    '.call-checkpoints',
  );
  if (await realpath(checkpointDirectory) !== expectedRealDirectory) {
    throw new Error('The canonical call-checkpoint directory must not contain symlink aliases.');
  }
  const fileName = `${crypto.createHash('sha256').update(callId).digest('hex')}.json`;
  const checkpointPath = path.join(checkpointDirectory, fileName);
  const checkpointPayload = { schemaVersion: 2, callId, requestHash, result };
  const serialized = `${JSON.stringify(checkpointPayload, null, 2)}\n`;
  const temporaryPath = `${checkpointPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const handle = await open(temporaryPath, 'wx', 0o600);
  try {
    await handle.writeFile(serialized);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporaryPath, checkpointPath);
  return {
    relativePath: path.posix.join('.call-checkpoints', fileName),
    sha256: crypto.createHash('sha256').update(serialized).digest('hex'),
  };
}

async function readPrivateCallCheckpoint({ repoRoot, completedCall }) {
  if (!completedCall.resultAvailable || !completedCall.resultCheckpoint) {
    throw new Error(`Completed stable call ${completedCall.callId} has no replayable result; use explicit recovery.`);
  }
  const checkpointPath = path.resolve(
    repoRoot,
    path.dirname(CANONICAL_SPEND_LEDGER_RELATIVE_PATH),
    completedCall.resultCheckpoint.relativePath,
  );
  const expectedPath = path.resolve(
    repoRoot,
    path.dirname(CANONICAL_SPEND_LEDGER_RELATIVE_PATH),
    '.call-checkpoints',
    `${crypto.createHash('sha256').update(completedCall.callId).digest('hex')}.json`,
  );
  if (checkpointPath !== expectedPath) throw new Error('Completed-call checkpoint path is not canonical.');
  const serialized = await readFile(checkpointPath, 'utf8');
  const digest = crypto.createHash('sha256').update(serialized).digest('hex');
  if (digest !== completedCall.resultCheckpoint.sha256) {
    throw new Error(`Completed-call checkpoint integrity failure for ${completedCall.callId}.`);
  }
  const checkpoint = JSON.parse(serialized);
  if (checkpoint.schemaVersion !== 2 || checkpoint.callId !== completedCall.callId
    || checkpoint.requestHash !== completedCall.requestHash) {
    throw new Error(`Completed-call checkpoint identity failure for ${completedCall.callId}.`);
  }
  return checkpoint.result;
}

function scoringSourceId(payload) {
  const runIds = (payload.results ?? []).map(({ runId }) => runId);
  if (runIds.some((runId) => typeof runId !== 'string' || !runId)) {
    throw new Error('Every evaluator row requires a stable run ID before checkpointing.');
  }
  if (new Set(runIds).size !== runIds.length) {
    throw new Error('Evaluator checkpoint run IDs must be unique.');
  }
  return hashCanonicalValue({
    sourceSchemaVersion: 2,
    generatedAt: payload.generatedAt,
    corpus: payload.corpus ?? null,
    candidates: payload.candidates ?? [],
    cases: payload.cases ?? [],
    sourceRows: payload.results ?? [],
  });
}

export function buildScoringCheckpointPath({ resultsDir, payload }) {
  return path.join(resultsDir, '.score-checkpoints', `model-bakeoff-${scoringSourceId(payload)}.json`);
}

async function readScoringCheckpoint(checkpointPath) {
  try {
    return JSON.parse(await readFile(checkpointPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function withoutProperty(value, property) {
  const copy = { ...value };
  delete copy[property];
  return copy;
}

function addCheckpointHash(checkpoint) {
  return {
    ...checkpoint,
    checkpointHash: hashCanonicalValue(checkpoint),
  };
}

function addScoredRowIntegrity(sourceRow, scoredRow, completedCall) {
  if (scoredRow?.runId !== sourceRow.runId) {
    throw new Error(`Evaluator changed stable run ID ${sourceRow.runId}.`);
  }
  const rowWithoutIntegrity = withoutProperty(scoredRow, 'evaluatorCheckpointIntegrity');
  const integrity = {
    sourceRowHash: hashCanonicalValue(sourceRow),
    evaluatorRequestHash: completedCall?.requestHash ?? null,
    completedCallId: completedCall?.callId ?? null,
    completedCallHash: completedCall ? hashCanonicalValue(completedCall) : null,
    scoredRowHash: hashCanonicalValue(rowWithoutIntegrity),
  };
  if (completedCall && (completedCall.type !== 'evaluation' || completedCall.resultAvailable !== true
    || !/^[a-f0-9]{64}$/.test(completedCall.requestHash ?? ''))) {
    throw new Error(`Evaluator completed-call integrity metadata is invalid for ${sourceRow.runId}.`);
  }
  return { ...rowWithoutIntegrity, evaluatorCheckpointIntegrity: integrity };
}

async function validateScoredRowIntegrity({ sourceRow, scoredRow, getCompletedCall }) {
  const integrity = scoredRow?.evaluatorCheckpointIntegrity;
  if (!integrity || integrity.sourceRowHash !== hashCanonicalValue(sourceRow)
    || integrity.scoredRowHash !== hashCanonicalValue(withoutProperty(scoredRow, 'evaluatorCheckpointIntegrity'))) {
    throw new Error(`Evaluator scored-row integrity failure for ${sourceRow.runId}.`);
  }
  if (integrity.completedCallId === null) {
    if (integrity.evaluatorRequestHash !== null || integrity.completedCallHash !== null) {
      throw new Error(`Evaluator skipped-row integrity failure for ${sourceRow.runId}.`);
    }
    return;
  }
  if (typeof getCompletedCall !== 'function') {
    throw new Error('A completed-call journal reader is required to trust evaluator checkpoints.');
  }
  const completedCall = await getCompletedCall(integrity.completedCallId);
  if (!completedCall || completedCall.callId !== integrity.completedCallId
    || completedCall.type !== 'evaluation' || completedCall.resultAvailable !== true
    || completedCall.requestHash !== integrity.evaluatorRequestHash
    || hashCanonicalValue(completedCall) !== integrity.completedCallHash) {
    throw new Error(`Evaluator completed-call journal integrity failure for ${sourceRow.runId}.`);
  }
}

export async function scoreRowsWithCheckpoint({
  payload,
  checkpointPath,
  scoreRow,
  getCompletedCall,
  getCheckpointMetadata,
}) {
  if (!checkpointPath) throw new Error('An evaluator checkpoint path is required.');
  if (typeof scoreRow !== 'function') throw new Error('An evaluator row scorer is required.');
  const sourceId = scoringSourceId(payload);
  const existing = await readScoringCheckpoint(checkpointPath);
  if (existing) {
    const checkpointWithoutHash = withoutProperty(existing, 'checkpointHash');
    if (existing.schemaVersion !== 2
      || existing.checkpointHash !== hashCanonicalValue(checkpointWithoutHash)) {
      throw new Error('Evaluator checkpoint integrity hash mismatch.');
    }
    if (existing.sourceId !== sourceId) {
      throw new Error('Evaluator checkpoint does not match the immutable source rows.');
    }
  }

  const sourceRows = payload.results ?? [];
  const sourceRunIds = new Set(sourceRows.map(({ runId }) => runId));
  const completedRunIds = existing?.completedRunIds ?? [];
  if (!Array.isArray(completedRunIds)
    || new Set(completedRunIds).size !== completedRunIds.length
    || completedRunIds.some((runId) => !sourceRunIds.has(runId))) {
    throw new Error('Evaluator checkpoint contains invalid completed run IDs.');
  }
  const completed = new Map(
    (existing?.results ?? [])
      .filter(({ runId }) => completedRunIds.includes(runId))
      .map((row) => [row.runId, row]),
  );
  if (completed.size !== completedRunIds.length) {
    throw new Error('Evaluator checkpoint is missing a completed result row.');
  }
  const sourceRowsById = new Map(sourceRows.map((row) => [row.runId, row]));
  for (const [runId, scoredRow] of completed) {
    await validateScoredRowIntegrity({
      sourceRow: sourceRowsById.get(runId),
      scoredRow,
      getCompletedCall,
    });
  }
  const metadata = {};
  if (existing?.cumulativeSpend) metadata.cumulativeSpend = existing.cumulativeSpend;

  const checkpointPayload = (complete) => addCheckpointHash({
      ...payload,
      ...metadata,
      schemaVersion: 2,
      checkpointKind: 'gemini-migration-evaluator',
      sourceId,
      checkpointedAt: new Date().toISOString(),
      qualityScored: complete,
      scoringIncomplete: !complete,
      completedRunIds: sourceRows
        .map(({ runId }) => runId)
        .filter((runId) => completed.has(runId)),
      results: sourceRows.map((row) => completed.get(row.runId) ?? row),
    });

  for (const sourceRow of sourceRows) {
    if (completed.has(sourceRow.runId)) continue;
    const outcome = await scoreRow(sourceRow);
    const scoredRow = addScoredRowIntegrity(
      sourceRow,
      outcome?.scoredRow ?? outcome,
      outcome?.completedCall ?? null,
    );
    completed.set(sourceRow.runId, scoredRow);
    await atomicWriteJson(checkpointPath, checkpointPayload(false), { privateFile: true });
    if (getCheckpointMetadata) {
      Object.assign(metadata, await getCheckpointMetadata());
      await atomicWriteJson(checkpointPath, checkpointPayload(false), { privateFile: true });
    }
  }

  const finalPayload = checkpointPayload(true);
  await atomicWriteJson(checkpointPath, finalPayload, { privateFile: true });
  return finalPayload;
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function quarantineLock(lockPath, expectedToken, action) {
  const quarantinePath = `${lockPath}.${action}.${process.pid}.${crypto.randomUUID()}`;
  try {
    await rename(lockPath, quarantinePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  let metadata;
  try {
    metadata = JSON.parse(await readFile(quarantinePath, 'utf8'));
  } catch {
    metadata = null;
  }
  if (metadata?.ownerToken !== expectedToken) {
    try {
      await rename(quarantinePath, lockPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    return false;
  }
  await unlink(quarantinePath).catch((error) => {
    if (error?.code !== 'ENOENT') throw error;
  });
  return true;
}

async function recoverDeadLock(lockPath, { staleMs, processAlive }) {
  let metadata;
  try {
    metadata = JSON.parse(await readFile(lockPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return true;
    let lockStats;
    try {
      lockStats = await lstat(lockPath);
    } catch (statError) {
      if (statError?.code === 'ENOENT') return true;
      return false;
    }
    if ((Date.now() - lockStats.mtimeMs) < staleMs) return false;
    const quarantinePath = `${lockPath}.malformed.${process.pid}.${crypto.randomUUID()}`;
    try {
      await rename(lockPath, quarantinePath);
    } catch (renameError) {
      if (renameError?.code === 'ENOENT') return true;
      throw renameError;
    }
    try {
      const currentStats = await lstat(quarantinePath);
      const unchanged = currentStats.dev === lockStats.dev
        && currentStats.ino === lockStats.ino
        && currentStats.mtimeMs === lockStats.mtimeMs;
      if (!unchanged) {
        await rename(quarantinePath, lockPath);
        return false;
      }
      await unlink(quarantinePath);
      return true;
    } catch (recoveryError) {
      await rename(quarantinePath, lockPath).catch(() => {});
      if (recoveryError?.code === 'ENOENT') return true;
      throw recoveryError;
    }
  }
  const ageMs = Date.now() - Date.parse(metadata.createdAt);
  if (!Number.isInteger(metadata.ownerPid) || !metadata.ownerToken
    || !Number.isFinite(ageMs) || ageMs < staleMs || processAlive(metadata.ownerPid)) {
    return false;
  }
  return quarantineLock(lockPath, metadata.ownerToken, 'stale');
}

async function withLedgerLock(ledgerPath, callback, options = {}) {
  const lockPath = `${ledgerPath}.lock`;
  const ownerToken = crypto.randomUUID();
  const candidatePath = `${lockPath}.candidate.${process.pid}.${ownerToken}`;
  const lockOptions = {
    attempts: options.attempts ?? 100,
    retryMs: options.retryMs ?? 10,
    staleMs: options.staleMs ?? 30_000,
    processAlive: options.processAlive ?? isProcessAlive,
  };
  const candidateHandle = await open(candidatePath, 'wx');
  try {
    await candidateHandle.writeFile(`${JSON.stringify({
        ownerPid: process.pid,
        ownerToken,
        createdAt: new Date().toISOString(),
      })}\n`);
    await candidateHandle.sync();
  } finally {
    await candidateHandle.close();
  }

  let acquired = false;
  try {
    for (let attempt = 0; attempt < lockOptions.attempts; attempt += 1) {
      try {
        await link(candidatePath, lockPath);
        acquired = true;
        break;
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        await recoverDeadLock(lockPath, lockOptions);
        if (attempt === lockOptions.attempts - 1) {
          throw new Error(`Could not acquire Phase 3 spend ledger lock after ${lockOptions.attempts} attempts.`);
        }
        await new Promise((resolve) => setTimeout(resolve, lockOptions.retryMs));
      }
    }
    if (!acquired) throw new Error('Could not acquire Phase 3 spend ledger lock.');
    return await callback();
  } finally {
    await unlink(candidatePath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
    if (acquired) await quarantineLock(lockPath, ownerToken, 'release');
  }
}

function serializedInputByteUpperBound(request) {
  return Buffer.byteLength(JSON.stringify({
    contents: request.contents,
    systemInstruction: request.config?.systemInstruction,
    responseSchema: request.config?.responseSchema,
  }), 'utf8');
}

function validateBoundedRequest(request, tokenLimits) {
  if (!Number.isInteger(tokenLimits?.maxInputTokens) || tokenLimits.maxInputTokens <= 0) {
    throw new Error('A positive explicit input token upper bound is required.');
  }
  if (!Number.isInteger(tokenLimits?.maxOutputTokens) || tokenLimits.maxOutputTokens <= 0) {
    throw new Error('A positive explicit output token upper bound is required.');
  }
  if (request?.config?.maxOutputTokens !== tokenLimits.maxOutputTokens) {
    throw new Error(`Request maxOutputTokens must equal the explicit cap ${tokenLimits.maxOutputTokens}.`);
  }
  const byteUpperBound = serializedInputByteUpperBound(request);
  if (byteUpperBound > tokenLimits.maxInputTokens) {
    throw new Error(`Request input token upper bound ${byteUpperBound} exceeds cap ${tokenLimits.maxInputTokens}.`);
  }
  return byteUpperBound;
}

export function calculateCallUpperBoundNanoUsd(configuration, tokenLimits) {
  const input = tokenLimits?.maxInputTokens;
  const output = tokenLimits?.maxOutputTokens;
  if (!Number.isInteger(input) || input <= 0 || !Number.isInteger(output) || output <= 0) {
    throw new Error('Explicit positive input and output token caps are required for a call upper bound.');
  }
  const liability = (input * configuredNanoUsdPerToken(configuration.inputUsdPerMillion, 'Input price'))
    + (output * configuredNanoUsdPerToken(configuration.outputUsdPerMillion, 'Output price'));
  if (!Number.isSafeInteger(liability) || liability <= 0) {
    throw new Error('Call liability does not fit positive safe integer nano-USD accounting.');
  }
  return liability;
}

export function calculateCallUpperBoundUsd(configuration, tokenLimits) {
  return nanoUsdToUsd(calculateCallUpperBoundNanoUsd(configuration, tokenLimits));
}

async function readLedgerAtCanonicalPath(ledgerPath, budgetUsd) {
  const parsed = JSON.parse(await readFile(ledgerPath, 'utf8'));
  const migrated = migrateCommittedZeroLedger(parsed, budgetUsd);
  if (migrated) {
    await atomicWriteJson(ledgerPath, migrated);
    return migrated;
  }
  return validateLedger(parsed, budgetUsd);
}

async function reserveSpend({
  ledgerPath,
  budgetUsd,
  type,
  runId,
  requestHash,
  configuration,
  tokenLimits,
  lockOptions,
}) {
  if (!SPEND_TYPES.has(type)) throw new Error(`Unknown Phase 3 spend type: ${type}`);
  if (!runId) throw new Error('A stable run ID is required before reserving Phase 3 spend.');
  const callId = `${type}:${runId}`;
  const liabilityNanoUsd = calculateCallUpperBoundNanoUsd(configuration, tokenLimits);
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(ledgerPath, budgetUsd);
    const completedCall = ledger.completedCalls[callId];
    if (completedCall) {
      if (completedCall.configurationId !== configuration.id || completedCall.requestHash !== requestHash) {
        throw new Error(`Phase 3 request identity mismatch for completed stable call ${callId}.`);
      }
      return { completedCall };
    }
    const pendingCall = ledger.pendingReservations.find((reservation) => reservation.callId === callId);
    if (pendingCall && (pendingCall.configurationId !== configuration.id || pendingCall.requestHash !== requestHash)) {
      throw new Error(`Phase 3 request identity mismatch for pending stable call ${callId}.`);
    }
    if (pendingCall) {
      throw new Error(`Phase 3 stable call already has an unresolved spend liability: ${callId}`);
    }
    const retryAction = ledger.recoveryActions.find((action) => action.retryCallId === callId);
    if (/:retry-\d+$/.test(runId) && !retryAction) {
      throw new Error(`Phase 3 retry attempt requires explicit audited recovery: ${callId}`);
    }
    if (retryAction?.retryRequestHash && retryAction.retryRequestHash !== requestHash) {
      throw new Error(`Phase 3 request identity mismatch for recovered retry ${callId}.`);
    }
    const projected = ledger.totalSpendNanoUsd + ledger.reservedNanoUsd + liabilityNanoUsd;
    if (!Number.isSafeInteger(projected) || projected > ledger.budgetNanoUsd) {
      throw new Error(`Phase 3 budget stop before ${type} call: ${projected} nano-USD could exceed ${ledger.budgetNanoUsd}.`);
    }
    const createdAt = new Date().toISOString();
    const reservation = {
      id: crypto.randomUUID(),
      callId,
      runId,
      type,
      status: 'reserved',
      liabilityNanoUsd,
      ownerPid: process.pid,
      ownerToken: crypto.randomUUID(),
      configurationId: configuration.id,
      requestHash,
      maxInputTokens: tokenLimits.maxInputTokens,
      maxOutputTokens: tokenLimits.maxOutputTokens,
      createdAt,
    };
    ledger.pendingReservations.push(reservation);
    ledger.reservedNanoUsd += liabilityNanoUsd;
    if (retryAction) {
      retryAction.retryRequestHash = requestHash;
      retryAction.retryReservedAt = createdAt;
    }
    ledger.updatedAt = createdAt;
    await atomicWriteJson(ledgerPath, ledger);
    return { reservation };
  }, lockOptions);
}

async function updateReservation({ ledgerPath, budgetUsd, reservation, lockOptions, update }) {
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(ledgerPath, budgetUsd);
    const index = ledger.pendingReservations.findIndex(({ id }) => id === reservation.id);
    if (index < 0) throw new Error(`Phase 3 spend reservation was not found: ${reservation.id}`);
    update(ledger.pendingReservations[index], ledger, index);
    ledger.updatedAt = new Date().toISOString();
    await atomicWriteJson(ledgerPath, ledger);
    return ledger.pendingReservations[index] ?? null;
  }, lockOptions);
}

async function markDispatched(options) {
  return updateReservation({
    ...options,
    update: (pending) => {
      if (pending.status !== 'reserved') throw new Error(`Phase 3 reservation is not dispatchable: ${pending.status}`);
      pending.status = 'dispatched';
      pending.dispatchedAt = new Date().toISOString();
    },
  });
}

async function markUnresolved(options, reason) {
  return updateReservation({
    ...options,
    update: (pending) => {
      if (pending.status === 'reserved') {
        throw new Error('Cannot mark an undispatched Phase 3 reservation as potentially spent.');
      }
      pending.status = 'unresolved';
      pending.reason = reason;
      pending.unresolvedAt = new Date().toISOString();
    },
  });
}

async function settleSpend({
  ledgerPath,
  budgetUsd,
  reservation,
  actualNanoUsd,
  usageMetadata,
  resultCheckpoint,
  providerDurationMs,
  lockOptions,
}) {
  requireSafeNonNegativeInteger(actualNanoUsd, 'Actual call spend');
  requireSafeNonNegativeInteger(providerDurationMs, 'Provider duration');
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(ledgerPath, budgetUsd);
    const index = ledger.pendingReservations.findIndex(({ id }) => id === reservation.id);
    if (index < 0) throw new Error(`Phase 3 spend reservation was not found: ${reservation.id}`);
    const pending = ledger.pendingReservations[index];
    if (pending.status !== 'dispatched') throw new Error(`Phase 3 reservation is not settleable: ${pending.status}`);
    if (actualNanoUsd > pending.liabilityNanoUsd) {
      throw new Error(`Actual ${pending.type} spend ${actualNanoUsd} nano-USD exceeded bounded liability ${pending.liabilityNanoUsd}.`);
    }
    ledger.pendingReservations.splice(index, 1);
    ledger.reservedNanoUsd -= pending.liabilityNanoUsd;
    ledger[pending.type].calls += 1;
    ledger[pending.type].spendNanoUsd += actualNanoUsd;
    ledger.totalSpendNanoUsd = ledger.generation.spendNanoUsd + ledger.evaluation.spendNanoUsd;
    const completedAt = new Date().toISOString();
    ledger.completedCalls[pending.callId] = {
      callId: pending.callId,
      runId: pending.runId,
      type: pending.type,
      configurationId: pending.configurationId,
      requestHash: pending.requestHash,
      liabilityNanoUsd: pending.liabilityNanoUsd,
      spendNanoUsd: actualNanoUsd,
      usageMetadata,
      providerDurationMs,
      resultAvailable: true,
      resolution: 'provider_response',
      resultCheckpoint,
      completedAt,
    };
    ledger.updatedAt = completedAt;
    await atomicWriteJson(ledgerPath, ledger);
    return ledger.completedCalls[pending.callId];
  }, lockOptions);
}

function validateRecoveryOperatorMetadata(reasonCode, operatorId) {
  if (!RECOVERY_REASON_CODES.has(reasonCode)) {
    throw new Error(`Recovery reason code must be one of: ${[...RECOVERY_REASON_CODES].join(', ')}.`);
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(operatorId ?? '')) {
    throw new Error('Recovery operator ID must be 1-64 safe metadata characters.');
  }
}

export async function recoverAmbiguousCall({
  repoRoot,
  requestedPath,
  ledgerPath,
  budgetUsd = 10,
  callId,
  reasonCode,
  operatorId,
  dryRun = false,
  lockOptions,
}) {
  validateRecoveryOperatorMetadata(reasonCode, operatorId);
  if (typeof callId !== 'string' || !callId.includes(':')) {
    throw new Error('A full stable call ID is required for recovery.');
  }
  const canonicalPath = await resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath });
  return withLedgerLock(canonicalPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(canonicalPath, budgetUsd);
    const pendingIndex = ledger.pendingReservations.findIndex((item) => item.callId === callId);
    const pending = pendingIndex >= 0 ? ledger.pendingReservations[pendingIndex] : null;
    const existing = ledger.completedCalls[callId] ?? null;
    if (!pending && !existing) throw new Error(`No ambiguous or damaged Phase 3 call found: ${callId}`);
    if (pending?.status === 'reserved') {
      throw new Error('A proven-undispatched reservation must be reconciled, not operator-settled as billed.');
    }
    if (existing) {
      if (!existing.resultAvailable) throw new Error(`Phase 3 call was already recovered: ${callId}`);
      if (reasonCode !== 'checkpoint-damaged') {
        throw new Error('A settled call can be recovered only with checkpoint-damaged reason metadata.');
      }
      let checkpointIsValid = false;
      try {
        await readPrivateCallCheckpoint({ repoRoot, completedCall: existing });
        checkpointIsValid = true;
      } catch {
        checkpointIsValid = false;
      }
      if (checkpointIsValid) throw new Error(`Completed call checkpoint is valid and cannot be recovered: ${callId}`);
    }

    const original = pending ?? existing;
    const liabilityNanoUsd = original.liabilityNanoUsd;
    const topUpNanoUsd = pending ? liabilityNanoUsd : liabilityNanoUsd - existing.spendNanoUsd;
    requireSafeNonNegativeInteger(topUpNanoUsd, 'Recovery spend top-up');
    const projected = ledger.totalSpendNanoUsd + ledger.reservedNanoUsd
      - (pending?.liabilityNanoUsd ?? 0) + topUpNanoUsd;
    if (!Number.isSafeInteger(projected) || projected > ledger.budgetNanoUsd) {
      throw new Error('Phase 3 recovery cannot settle the original maximum liability without exceeding the budget.');
    }
    const retryAttempt = ledger.recoveryActions
      .filter((action) => action.originalCallId === callId).length + 1;
    const retryRunId = `${original.runId}:retry-${retryAttempt}`;
    const retryCallId = `${original.type}:${retryRunId}`;
    if (ledger.pendingReservations.some((item) => item.callId === retryCallId)
      || ledger.completedCalls[retryCallId]
      || ledger.recoveryActions.some((action) => action.retryCallId === retryCallId)) {
      throw new Error(`Deterministic recovery retry ID already exists: ${retryCallId}`);
    }
    const preview = {
      callId,
      originalStatus: pending?.status ?? 'completed-checkpoint-damaged',
      settledNanoUsd: liabilityNanoUsd,
      retryAttempt,
      retryRunId,
      retryCallId,
      reasonCode,
      operatorId,
    };
    if (dryRun) return preview;

    const resolvedAt = new Date().toISOString();
    if (pending) {
      ledger.pendingReservations.splice(pendingIndex, 1);
      ledger.reservedNanoUsd -= pending.liabilityNanoUsd;
      ledger[pending.type].calls += 1;
      ledger[pending.type].spendNanoUsd += liabilityNanoUsd;
      ledger.completedCalls[callId] = {
        callId,
        runId: pending.runId,
        type: pending.type,
        configurationId: pending.configurationId,
        requestHash: pending.requestHash,
        liabilityNanoUsd,
        spendNanoUsd: liabilityNanoUsd,
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
        providerDurationMs: null,
        resultAvailable: false,
        resolution: 'operator-settled-upper-bound',
        resultCheckpoint: null,
        completedAt: resolvedAt,
      };
    } else {
      existing.spendNanoUsd = liabilityNanoUsd;
      existing.resultAvailable = false;
      existing.resolution = 'operator-settled-upper-bound';
      existing.resultCheckpoint = null;
      ledger[existing.type].spendNanoUsd += topUpNanoUsd;
    }
    ledger.totalSpendNanoUsd = ledger.generation.spendNanoUsd + ledger.evaluation.spendNanoUsd;
    const action = {
      actionId: crypto.randomUUID(),
      originalCallId: callId,
      originalRequestHash: original.requestHash,
      originalStatus: preview.originalStatus,
      reasonCode,
      operatorId,
      resolvedAt,
      settledNanoUsd: liabilityNanoUsd,
      retryAttempt,
      retryRunId,
      retryCallId,
      retryRequestHash: null,
    };
    ledger.recoveryActions.push(action);
    ledger.updatedAt = resolvedAt;
    validateLedger(ledger, budgetUsd);
    await atomicWriteJson(canonicalPath, ledger);
    return { ...preview, actionId: action.actionId, resolvedAt };
  }, lockOptions);
}

export async function reconcileSpendLedger({
  repoRoot,
  requestedPath,
  ledgerPath,
  budgetUsd = 10,
  isProcessAlive: processAlive = isProcessAlive,
  lockOptions,
}) {
  const canonicalPath = await resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath });
  return withLedgerLock(canonicalPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(canonicalPath, budgetUsd);
    let changed = false;
    ledger.pendingReservations = ledger.pendingReservations.filter((reservation) => {
      if (processAlive(reservation.ownerPid)) return true;
      changed = true;
      if (reservation.status === 'reserved') return false;
      reservation.status = 'unresolved';
      reservation.reason ??= 'owner_exited_after_dispatch';
      reservation.unresolvedAt ??= new Date().toISOString();
      return true;
    });
    if (changed) {
      ledger.reservedNanoUsd = ledger.pendingReservations.reduce((sum, item) => sum + item.liabilityNanoUsd, 0);
      ledger.updatedAt = new Date().toISOString();
      await atomicWriteJson(canonicalPath, ledger);
    }
    return ledger;
  }, lockOptions);
}

export async function runBudgetedCall({
  repoRoot,
  ledgerPath,
  requestedPath,
  budgetUsd = 10,
  type,
  runId,
  configuration,
  tokenLimits,
  request,
  requestContext,
  call,
  actualUsd,
  serializeResult = (response) => response,
  deserializeResult = (result) => result,
  faultInjection = {},
  lockOptions,
  nowMs = () => performance.now(),
}) {
  const canonicalPath = await resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath });
  validateBoundedRequest(request, tokenLimits);
  const requestHash = buildRequestIdentityHash({ type, runId, configuration, request, requestContext });
  await reconcileSpendLedger({
    repoRoot,
    ledgerPath: canonicalPath,
    budgetUsd,
    lockOptions,
  });
  const decision = await reserveSpend({
    ledgerPath: canonicalPath,
    budgetUsd,
    type,
    runId,
    requestHash,
    configuration,
    tokenLimits,
    lockOptions,
  });
  if (decision.completedCall) {
    const durableResult = await readPrivateCallCheckpoint({
      repoRoot,
      completedCall: decision.completedCall,
    });
    return bindProviderDuration(
      deserializeResult(durableResult),
      decision.completedCall.providerDurationMs,
    );
  }
  const { reservation } = decision;
  try {
    await markDispatched({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    });
  } catch (error) {
    throw new Error(`Phase 3 dispatch accounting failed before provider call: ${error.message}`, { cause: error });
  }
  await faultInjection.afterDispatchRecord?.();

  let response;
  let providerDurationMs;
  try {
    const providerStartedAt = nowMs();
    response = await call(request);
    providerDurationMs = Math.max(0, Math.round(nowMs() - providerStartedAt));
    requireSafeNonNegativeInteger(providerDurationMs, 'Provider duration');
  } catch (error) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'provider_rejection').catch(() => {});
    throw error;
  }
  await faultInjection.afterProviderResponse?.();

  const promptTokens = response?.usageMetadata?.promptTokenCount;
  const visibleCandidateTokens = response?.usageMetadata?.candidatesTokenCount;
  const rawThoughtTokens = response?.usageMetadata?.thoughtsTokenCount;
  const thoughtTokens = Number.isInteger(rawThoughtTokens)
    ? rawThoughtTokens
    : (request.config?.thinkingConfig?.thinkingBudget === 0 ? 0 : null);
  if (!Number.isInteger(promptTokens) || promptTokens < 0
    || !Number.isInteger(visibleCandidateTokens) || visibleCandidateTokens < 0
    || !Number.isInteger(thoughtTokens) || thoughtTokens < 0) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'missing_usage').catch(() => {});
    throw new Error(`Phase 3 spend unresolved for ${runId}: missing usage metadata after dispatch.`);
  }

  const normalizedUsageMetadata = {
    promptTokenCount: promptTokens,
    candidatesTokenCount: visibleCandidateTokens,
    thoughtsTokenCount: thoughtTokens,
  };
  let actualNanoUsd;
  let resultCheckpoint;
  try {
    actualNanoUsd = actualUsd === undefined
      ? calculateUsageCostNanoUsd(configuration, normalizedUsageMetadata)
      : usdToNanoUsdCeil(actualUsd(response));
    const outputTokens = visibleCandidateTokens + thoughtTokens;
    if (promptTokens > tokenLimits.maxInputTokens || outputTokens > tokenLimits.maxOutputTokens) {
      throw new Error('Provider usage exceeded or did not satisfy explicit token caps.');
    }
    resultCheckpoint = await writePrivateCallCheckpoint({
      repoRoot,
      callId: reservation.callId,
      requestHash: reservation.requestHash,
      result: serializeResult(response),
    });
  } catch (error) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'usage_pricing_or_checkpoint_failure').catch(() => {});
    throw error;
  }
  await faultInjection.afterResultCheckpoint?.();

  try {
    await settleSpend({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      actualNanoUsd,
      usageMetadata: normalizedUsageMetadata,
      resultCheckpoint,
      providerDurationMs,
      lockOptions,
    });
  } catch (error) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'usage_or_pricing_failure').catch(() => {});
    throw error;
  }
  await faultInjection.afterSettlement?.();
  return bindProviderDuration(response, providerDurationMs);
}

function pendingLiabilityNanoUsd(ledger, type, status) {
  return ledger.pendingReservations
    .filter((item) => (!type || item.type === type) && (!status || item.status === status))
    .reduce((sum, item) => sum + item.liabilityNanoUsd, 0);
}

export function summarizeSpendLedger(ledger) {
  validateLedger(ledger, nanoUsdToUsd(ledger.budgetNanoUsd));
  const summarizeType = (type) => {
    const reservedLiabilityNanoUsd = pendingLiabilityNanoUsd(ledger, type, 'reserved');
    const dispatchedLiabilityNanoUsd = pendingLiabilityNanoUsd(ledger, type, 'dispatched');
    const unresolvedLiabilityNanoUsd = pendingLiabilityNanoUsd(ledger, type, 'unresolved');
    const totalLiabilityNanoUsd = reservedLiabilityNanoUsd
      + dispatchedLiabilityNanoUsd
      + unresolvedLiabilityNanoUsd;
    return {
      settledCalls: ledger[type].calls,
      settledNanoUsd: ledger[type].spendNanoUsd,
      settledUsd: nanoUsdToUsd(ledger[type].spendNanoUsd),
      reservedLiabilityNanoUsd,
      reservedLiabilityUsd: nanoUsdToUsd(reservedLiabilityNanoUsd),
      dispatchedLiabilityNanoUsd,
      dispatchedLiabilityUsd: nanoUsdToUsd(dispatchedLiabilityNanoUsd),
      unresolvedLiabilityNanoUsd,
      unresolvedLiabilityUsd: nanoUsdToUsd(unresolvedLiabilityNanoUsd),
      totalLiabilityNanoUsd,
      totalLiabilityUsd: nanoUsdToUsd(totalLiabilityNanoUsd),
    };
  };
  const pendingCounts = {
    total: ledger.pendingReservations.length,
    generation: ledger.pendingReservations.filter(({ type }) => type === 'generation').length,
    evaluation: ledger.pendingReservations.filter(({ type }) => type === 'evaluation').length,
    reserved: ledger.pendingReservations.filter(({ status }) => status === 'reserved').length,
    dispatched: ledger.pendingReservations.filter(({ status }) => status === 'dispatched').length,
    unresolved: ledger.pendingReservations.filter(({ status }) => status === 'unresolved').length,
  };
  const settledNanoUsd = ledger.totalSpendNanoUsd;
  const liabilityNanoUsd = ledger.reservedNanoUsd;
  const totalCommittedNanoUsd = settledNanoUsd + liabilityNanoUsd;
  const remainingCapacityNanoUsd = ledger.budgetNanoUsd - totalCommittedNanoUsd;
  return {
    currency: ledger.currency,
    unit: ledger.unit,
    budgetNanoUsd: ledger.budgetNanoUsd,
    budgetUsd: nanoUsdToUsd(ledger.budgetNanoUsd),
    generation: summarizeType('generation'),
    evaluation: summarizeType('evaluation'),
    settledNanoUsd,
    settledUsd: nanoUsdToUsd(settledNanoUsd),
    liabilityNanoUsd,
    liabilityUsd: nanoUsdToUsd(liabilityNanoUsd),
    totalCommittedNanoUsd,
    totalCommittedUsd: nanoUsdToUsd(totalCommittedNanoUsd),
    remainingCapacityNanoUsd,
    remainingCapacityUsd: nanoUsdToUsd(remainingCapacityNanoUsd),
    pendingCounts,
  };
}

function percentile(values, percentileValue) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(percentileValue * sorted.length) - 1)];
}

export function calculateAggregateMetrics(results) {
  const successful = results.filter(({ status }) => status === 'success');
  const fewerWords = results.filter(({ useFewerWords }) => useFewerWords);
  const interest = results.filter((item) => item.interest);
  const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);
  const generation = roundUsd(sum(successful, ({ generationUsd = 0 }) => generationUsd));
  const evaluator = roundUsd(sum(results, ({ evaluatorUsd = 0 }) => evaluatorUsd));
  const latencies = results.map(({ durationMs = 0 }) => durationMs);

  return {
    runs: results.length,
    successfulRuns: successful.length,
    requestErrors: results.length - successful.length,
    parseErrors: results.filter(({ parseError }) => parseError).length,
    contractErrors: results.filter(({ contractError }) => contractError).length,
    safetyFlags: sum(results, ({ safetyFlags = [] }) => safetyFlags.length),
    fewerWords: {
      checked: fewerWords.length,
      compliant: fewerWords.filter(({ fewerWordsCompliant }) => fewerWordsCompliant).length,
    },
    interest: {
      checked: interest.length,
      leakage: interest.filter(({ interestLeakage }) => interestLeakage).length,
      grounded: interest.filter(({ interestGrounded }) => interestGrounded).length,
    },
    latencyMs: {
      median: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    tokens: {
      prompt: sum(results, ({ usageMetadata }) => usageMetadata?.promptTokenCount ?? 0),
      visibleCandidates: sum(results, ({ usageMetadata }) => usageMetadata?.candidatesTokenCount ?? 0),
      thoughts: sum(results, ({ usageMetadata }) => usageMetadata?.thoughtsTokenCount ?? 0),
      billedOutput: sum(results, ({ usageMetadata }) => (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0)),
      total: sum(results, ({ usageMetadata }) => usageMetadata?.totalTokenCount ?? 0),
    },
    spendUsd: {
      successfulRequests: generation,
      costPerSuccessfulRequest: successful.length
        ? roundUsd(generation / successful.length)
        : 0,
      evaluator,
      generationAndEvaluation: roundUsd(generation + evaluator),
    },
  };
}

export function calculateAggregateGates(results, {
  minimumPasses = 36,
  maximumBorderline = 3,
} = {}) {
  const groups = new Map();
  for (const result of results) {
    const candidateId = result.candidateId ?? 'unknown';
    const repeat = result.repeat ?? 1;
    const key = `${candidateId}\u0000${repeat}`;
    if (!groups.has(key)) groups.set(key, { candidateId, repeat, rows: [] });
    groups.get(key).rows.push(result);
  }

  return [...groups.values()]
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId) || left.repeat - right.repeat)
    .map(({ candidateId, repeat, rows }) => {
      const calibrationRows = rows.filter(({ isCalibrationCase }) => isCalibrationCase);
      const verdicts = { Pass: 0, Borderline: 0, Fail: 0, Unknown: 0 };
      for (const row of calibrationRows) {
        const verdict = ['Pass', 'Borderline', 'Fail'].includes(row.postprocessedVerdict)
          ? row.postprocessedVerdict
          : 'Unknown';
        verdicts[verdict] += 1;
      }
      const requestErrors = rows.filter((row) => row.status === 'error' || row.error).length;
      const parseErrors = rows.filter(({ parseError }) => parseError).length;
      const contractErrors = rows.filter(({ contractError }) => contractError).length;
      const safetyFlags = rows.reduce((total, row) => total + (row.safetyFlags?.length ?? 0), 0);
      const criticalSafetyOrSequenceOmissions = rows
        .filter(({ criticalSafetyOrSequenceOmission }) => criticalSafetyOrSequenceOmission).length;
      const interestGroundingViolations = rows
        .filter((row) => row.interest && row.interestGrounded === false).length;
      const crossInterestLeakage = rows.filter(({ interestLeakage }) => interestLeakage).length;
      const fewerWordsFailures = rows
        .filter((row) => row.useFewerWords && row.fewerWordsCompliant === false).length;
      const evaluated = calibrationRows.length > 0 && verdicts.Unknown === 0;
      const passesAll = evaluated
        && verdicts.Pass >= minimumPasses
        && verdicts.Borderline <= maximumBorderline
        && verdicts.Fail === 0
        && requestErrors === 0
        && parseErrors === 0
        && contractErrors === 0
        && safetyFlags === 0
        && criticalSafetyOrSequenceOmissions === 0
        && interestGroundingViolations === 0
        && crossInterestLeakage === 0
        && fewerWordsFailures === 0;

      return {
        candidateId,
        repeat,
        calibrationRuns: calibrationRows.length,
        verdicts,
        requestErrors,
        parseErrors,
        contractErrors,
        safetyFlags,
        criticalSafetyOrSequenceOmissions,
        interestGroundingViolations,
        crossInterestLeakage,
        fewerWordsFailures,
        evaluated,
        passesAll,
      };
    });
}

export function parseCliOptions(argv, { requireConfigurations = true } = {}) {
  const option = (name) => {
    const prefix = `--${name}=`;
    return argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  };
  const rawConfigurations = option('configurations') ?? option('configuration');
  const configurations = rawConfigurations
    ? selectConfigurations(rawConfigurations)
    : (requireConfigurations ? selectConfigurations('') : []);
  const repeats = Number(option('repeats') ?? 1);
  const limitValue = option('limit');
  const seed = Number(option('seed') ?? 20260813);
  const budgetUsd = Number(option('phase-budget-usd') ?? 10);
  if (!Number.isInteger(repeats) || repeats < 1) throw new Error('--repeats must be a positive integer.');
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer.');
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 10) {
    throw new Error('--phase-budget-usd must be greater than zero and no more than 10.');
  }
  const limit = limitValue === undefined ? null : Number(limitValue);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
    throw new Error('--limit must be a positive integer.');
  }
  return {
    configurations,
    repeats,
    limit,
    seed,
    budgetUsd,
    corpus: option('corpus'),
    ledgerPath: option('spend-ledger'),
    score: argv.includes('--score'),
  };
}

export function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && !process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
}
