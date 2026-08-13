import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  mkdir,
  open,
  readFile,
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

export function createInitialSpendLedger(budgetUsd = 10) {
  requireFiniteNonNegative(budgetUsd, 'Phase 3 budget');
  return {
    schemaVersion: 1,
    phase: 'gemini-model-migration-phase-3',
    currency: 'USD',
    budgetUsd: roundUsd(budgetUsd),
    generation: { calls: 0, spendUsd: 0 },
    evaluation: { calls: 0, spendUsd: 0 },
    totalSpendUsd: 0,
    reservedUsd: 0,
    pendingReservations: [],
    updatedAt: null,
  };
}

function validateLedger(ledger, budgetUsd) {
  if (ledger?.schemaVersion !== 1 || ledger.phase !== 'gemini-model-migration-phase-3') {
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
  return ledger;
}

export async function readSpendLedger(ledgerPath, budgetUsd = 10) {
  const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
  return validateLedger(ledger, budgetUsd);
}

async function atomicWriteJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await rename(temporaryPath, filePath);
}

async function withLedgerLock(ledgerPath, callback) {
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  const lockPath = `${ledgerPath}.lock`;
  let handle;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      handle = await open(lockPath, 'wx');
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST' || attempt === 99) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  try {
    return await callback();
  } finally {
    await handle?.close();
    await unlink(lockPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}

async function reserveSpend({ ledgerPath, budgetUsd, type, estimatedUsd }) {
  if (!SPEND_TYPES.has(type)) throw new Error(`Unknown Phase 3 spend type: ${type}`);
  requireFiniteNonNegative(estimatedUsd, 'Estimated call spend');
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readSpendLedger(ledgerPath, budgetUsd);
    const projected = roundUsd(ledger.totalSpendUsd + ledger.reservedUsd + estimatedUsd);
    if (projected > budgetUsd) {
      throw new Error(`Phase 3 budget stop before ${type} call: $${projected} could exceed $${budgetUsd}.`);
    }
    const reservation = {
      id: crypto.randomUUID(),
      type,
      estimatedUsd: roundUsd(estimatedUsd),
      createdAt: new Date().toISOString(),
    };
    ledger.pendingReservations.push(reservation);
    ledger.reservedUsd = roundUsd(ledger.reservedUsd + reservation.estimatedUsd);
    ledger.updatedAt = reservation.createdAt;
    await atomicWriteJson(ledgerPath, ledger);
    return reservation;
  });
}

async function settleSpend({ ledgerPath, budgetUsd, reservation, actualUsd }) {
  requireFiniteNonNegative(actualUsd, 'Actual call spend');
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readSpendLedger(ledgerPath, budgetUsd);
    const index = ledger.pendingReservations.findIndex(({ id }) => id === reservation.id);
    if (index < 0) throw new Error(`Phase 3 spend reservation was not found: ${reservation.id}`);
    ledger.pendingReservations.splice(index, 1);
    ledger.reservedUsd = roundUsd(ledger.reservedUsd - reservation.estimatedUsd);
    ledger[reservation.type].calls += 1;
    ledger[reservation.type].spendUsd = roundUsd(ledger[reservation.type].spendUsd + actualUsd);
    ledger.totalSpendUsd = roundUsd(ledger.generation.spendUsd + ledger.evaluation.spendUsd);
    ledger.updatedAt = new Date().toISOString();
    await atomicWriteJson(ledgerPath, ledger);
    return ledger;
  });
}

async function cancelReservation({ ledgerPath, budgetUsd, reservation }) {
  return withLedgerLock(ledgerPath, async () => {
    const ledger = await readSpendLedger(ledgerPath, budgetUsd);
    const index = ledger.pendingReservations.findIndex(({ id }) => id === reservation.id);
    if (index >= 0) {
      ledger.pendingReservations.splice(index, 1);
      ledger.reservedUsd = roundUsd(ledger.reservedUsd - reservation.estimatedUsd);
      ledger.updatedAt = new Date().toISOString();
      await atomicWriteJson(ledgerPath, ledger);
    }
    return ledger;
  });
}

export async function runBudgetedCall({
  ledgerPath,
  budgetUsd = 10,
  type,
  estimatedUsd,
  call,
  actualUsd,
}) {
  const reservation = await reserveSpend({ ledgerPath, budgetUsd, type, estimatedUsd });
  try {
    const response = await call();
    const actual = roundUsd(actualUsd(response));
    await settleSpend({ ledgerPath, budgetUsd, reservation, actualUsd: actual });
    return response;
  } catch (error) {
    await cancelReservation({ ledgerPath, budgetUsd, reservation });
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
