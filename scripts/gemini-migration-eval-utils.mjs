import crypto from 'node:crypto';
import fs from 'node:fs';
import {
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
export const MIGRATION_TOKEN_LIMITS = Object.freeze({
  generation: Object.freeze({ maxInputTokens: 32_768, maxOutputTokens: 1_024 }),
  evaluation: Object.freeze({ maxInputTokens: 65_536, maxOutputTokens: 4_096 }),
});

const SPEND_TYPES = new Set(['generation', 'evaluation']);
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
  const promptTokens = usageMetadata?.promptTokenCount ?? 0;
  const visibleCandidateTokens = usageMetadata?.candidatesTokenCount ?? 0;
  const thoughtTokens = usageMetadata?.thoughtsTokenCount ?? 0;
  return roundUsd(
    (promptTokens * configuration.inputUsdPerMillion / 1_000_000)
    + ((visibleCandidateTokens + thoughtTokens) * configuration.outputUsdPerMillion / 1_000_000),
  );
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

function validateLedger(ledger, budgetUsd) {
  if (ledger?.schemaVersion !== 2 || ledger.phase !== 'gemini-model-migration-phase-3') {
    throw new Error('Invalid Phase 3 spend ledger schema.');
  }
  if (ledger.budgetUsd !== roundUsd(budgetUsd)) {
    throw new Error(`Phase 3 spend ledger budget is ${ledger.budgetUsd}, not requested ${roundUsd(budgetUsd)}.`);
  }
  for (const type of SPEND_TYPES) {
    if (!Number.isInteger(ledger[type]?.calls) || ledger[type].calls < 0) {
      throw new Error(`Invalid ${type} call count in Phase 3 spend ledger.`);
    }
    requireFiniteNonNegative(ledger[type]?.spendUsd, `${type} spend`);
  }
  requireFiniteNonNegative(ledger.totalSpendUsd, 'total spend');
  requireFiniteNonNegative(ledger.reservedUsd, 'reserved spend');
  if (!Array.isArray(ledger.pendingReservations)) {
    throw new Error('Invalid Phase 3 pending reservations.');
  }
  const componentSpend = roundUsd(ledger.generation.spendUsd + ledger.evaluation.spendUsd);
  if (ledger.totalSpendUsd !== componentSpend) {
    throw new Error(`Invalid Phase 3 accounting: total spend does not equal component sums (${componentSpend}).`);
  }
  const pendingLiabilities = roundUsd(ledger.pendingReservations.reduce((total, reservation) => {
    if (!reservation?.id || !reservation.runId || !SPEND_TYPES.has(reservation.type)) {
      throw new Error('Invalid Phase 3 pending reservation identity or type.');
    }
    if (!['reserved', 'dispatched', 'unresolved'].includes(reservation.status)) {
      throw new Error(`Invalid Phase 3 pending reservation status: ${reservation.status}`);
    }
    requireFiniteNonNegative(reservation.liabilityUsd, 'pending liability');
    if (!Number.isInteger(reservation.ownerPid) || !reservation.ownerToken || !reservation.createdAt) {
      throw new Error('Invalid Phase 3 pending reservation owner metadata.');
    }
    if (reservation.status !== 'reserved' && !reservation.dispatchedAt) {
      throw new Error('Invalid Phase 3 dispatched reservation timestamp.');
    }
    return total + reservation.liabilityUsd;
  }, 0));
  if (ledger.reservedUsd !== pendingLiabilities) {
    throw new Error(`Invalid Phase 3 accounting: reserved spend does not equal pending liabilities (${pendingLiabilities}).`);
  }
  if (roundUsd(ledger.totalSpendUsd + ledger.reservedUsd) > ledger.budgetUsd) {
    throw new Error('Invalid Phase 3 accounting: spend plus liabilities exceeds the budget.');
  }
  const hasActivity = ledger.totalSpendUsd > 0 || ledger.reservedUsd > 0
    || ledger.generation.calls > 0 || ledger.evaluation.calls > 0;
  if (hasActivity && !ledger.updatedAt) {
    throw new Error('Invalid Phase 3 accounting: updatedAt is required after activity.');
  }
  return ledger;
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
  const ledger = JSON.parse(await readFile(canonicalPath, 'utf8'));
  return validateLedger(ledger, budgetUsd);
}

async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporaryPath, filePath);
}

function scoringSourceId(payload) {
  const runIds = (payload.results ?? []).map(({ runId }) => runId);
  if (runIds.some((runId) => typeof runId !== 'string' || !runId)) {
    throw new Error('Every evaluator row requires a stable run ID before checkpointing.');
  }
  if (new Set(runIds).size !== runIds.length) {
    throw new Error('Evaluator checkpoint run IDs must be unique.');
  }
  return crypto.createHash('sha256').update(JSON.stringify({
    generatedAt: payload.generatedAt,
    candidateIds: (payload.candidates ?? []).map(({ id }) => id),
    runIds,
  })).digest('hex');
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

export async function scoreRowsWithCheckpoint({
  payload,
  checkpointPath,
  scoreRow,
  getCheckpointMetadata,
}) {
  if (!checkpointPath) throw new Error('An evaluator checkpoint path is required.');
  if (typeof scoreRow !== 'function') throw new Error('An evaluator row scorer is required.');
  const sourceId = scoringSourceId(payload);
  const existing = await readScoringCheckpoint(checkpointPath);
  if (existing && (existing.schemaVersion !== 1 || existing.sourceId !== sourceId)) {
    throw new Error('Evaluator checkpoint does not match the requested bakeoff payload.');
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
  const metadata = {};
  if (existing?.cumulativeSpend) metadata.cumulativeSpend = existing.cumulativeSpend;

  const checkpointPayload = (complete) => ({
    ...payload,
    ...metadata,
    schemaVersion: 1,
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
    const scoredRow = await scoreRow(sourceRow);
    if (scoredRow?.runId !== sourceRow.runId) {
      throw new Error(`Evaluator changed stable run ID ${sourceRow.runId}.`);
    }
    completed.set(sourceRow.runId, scoredRow);
    await atomicWriteJson(checkpointPath, checkpointPayload(false));
    if (getCheckpointMetadata) {
      Object.assign(metadata, await getCheckpointMetadata());
      await atomicWriteJson(checkpointPath, checkpointPayload(false));
    }
  }

  const finalPayload = checkpointPayload(true);
  await atomicWriteJson(checkpointPath, finalPayload);
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

export function calculateCallUpperBoundUsd(configuration, tokenLimits) {
  const input = tokenLimits?.maxInputTokens;
  const output = tokenLimits?.maxOutputTokens;
  if (!Number.isInteger(input) || input <= 0 || !Number.isInteger(output) || output <= 0) {
    throw new Error('Explicit positive input and output token caps are required for a call upper bound.');
  }
  return roundUsd(
    (input * configuration.inputUsdPerMillion / 1_000_000)
    + (output * configuration.outputUsdPerMillion / 1_000_000),
  );
}

async function readLedgerAtCanonicalPath(ledgerPath, budgetUsd) {
  return validateLedger(JSON.parse(await readFile(ledgerPath, 'utf8')), budgetUsd);
}

async function reserveSpend({ ledgerPath, budgetUsd, type, runId, configuration, tokenLimits, lockOptions }) {
  if (!SPEND_TYPES.has(type)) throw new Error(`Unknown Phase 3 spend type: ${type}`);
  if (!runId) throw new Error('A stable run ID is required before reserving Phase 3 spend.');
  const liabilityUsd = calculateCallUpperBoundUsd(configuration, tokenLimits);
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(ledgerPath, budgetUsd);
    if (ledger.pendingReservations.some((reservation) => reservation.runId === runId)) {
      throw new Error(`Phase 3 run already has an unresolved spend liability: ${runId}`);
    }
    const projected = roundUsd(ledger.totalSpendUsd + ledger.reservedUsd + liabilityUsd);
    if (projected > budgetUsd) {
      throw new Error(`Phase 3 budget stop before ${type} call: $${projected} could exceed $${budgetUsd}.`);
    }
    const createdAt = new Date().toISOString();
    const reservation = {
      id: crypto.randomUUID(),
      runId,
      type,
      status: 'reserved',
      liabilityUsd,
      ownerPid: process.pid,
      ownerToken: crypto.randomUUID(),
      configurationId: configuration.id,
      maxInputTokens: tokenLimits.maxInputTokens,
      maxOutputTokens: tokenLimits.maxOutputTokens,
      createdAt,
    };
    ledger.pendingReservations.push(reservation);
    ledger.reservedUsd = roundUsd(ledger.reservedUsd + liabilityUsd);
    ledger.updatedAt = createdAt;
    await atomicWriteJson(ledgerPath, ledger);
    return reservation;
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

async function settleSpend({ ledgerPath, budgetUsd, reservation, actualUsd, lockOptions }) {
  requireFiniteNonNegative(actualUsd, 'Actual call spend');
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readLedgerAtCanonicalPath(ledgerPath, budgetUsd);
    const index = ledger.pendingReservations.findIndex(({ id }) => id === reservation.id);
    if (index < 0) throw new Error(`Phase 3 spend reservation was not found: ${reservation.id}`);
    const pending = ledger.pendingReservations[index];
    if (pending.status !== 'dispatched') throw new Error(`Phase 3 reservation is not settleable: ${pending.status}`);
    if (actualUsd > pending.liabilityUsd) {
      throw new Error(`Actual ${pending.type} spend $${actualUsd} exceeded bounded liability $${pending.liabilityUsd}.`);
    }
    ledger.pendingReservations.splice(index, 1);
    ledger.reservedUsd = roundUsd(ledger.reservedUsd - pending.liabilityUsd);
    ledger[pending.type].calls += 1;
    ledger[pending.type].spendUsd = roundUsd(ledger[pending.type].spendUsd + actualUsd);
    ledger.totalSpendUsd = roundUsd(ledger.generation.spendUsd + ledger.evaluation.spendUsd);
    ledger.updatedAt = new Date().toISOString();
    await atomicWriteJson(ledgerPath, ledger);
    return ledger;
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
      ledger.reservedUsd = roundUsd(ledger.pendingReservations.reduce((sum, item) => sum + item.liabilityUsd, 0));
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
  call,
  actualUsd = (response) => calculateUsageCost(configuration, response.usageMetadata),
  lockOptions,
}) {
  const canonicalPath = await resolveCanonicalSpendLedgerPath({ repoRoot, requestedPath, ledgerPath });
  validateBoundedRequest(request, tokenLimits);
  await reconcileSpendLedger({
    repoRoot,
    ledgerPath: canonicalPath,
    budgetUsd,
    lockOptions,
  });
  const reservation = await reserveSpend({
    ledgerPath: canonicalPath,
    budgetUsd,
    type,
    runId,
    configuration,
    tokenLimits,
    lockOptions,
  });
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

  let response;
  try {
    response = await call(request);
  } catch (error) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'provider_rejection').catch(() => {});
    throw error;
  }

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

  try {
    const actual = roundUsd(actualUsd(response));
    const outputTokens = visibleCandidateTokens + thoughtTokens;
    if (promptTokens > tokenLimits.maxInputTokens || outputTokens > tokenLimits.maxOutputTokens) {
      throw new Error('Provider usage exceeded or did not satisfy explicit token caps.');
    }
    return await settleSpend({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      actualUsd: actual,
      lockOptions,
    }).then(() => response);
  } catch (error) {
    await markUnresolved({
      ledgerPath: canonicalPath,
      budgetUsd,
      reservation,
      lockOptions,
    }, 'usage_or_pricing_failure').catch(() => {});
    throw error;
  }
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
