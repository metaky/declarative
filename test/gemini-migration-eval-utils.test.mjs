import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALL_CONFIGURATION_IDS,
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  MIGRATION_TOKEN_LIMITS,
  buildArtifactPaths,
  buildEvaluationPlan,
  calculateAggregateMetrics,
  calculateUsageCost,
  captureConfigurationMetadata,
  loadMigrationCorpus,
  readSpendLedger,
  runBudgetedCall,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(repoRoot, 'evals', 'gemini-migration-prompt-set.json');

function zeroLedger() {
  return {
    schemaVersion: 4,
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
    recoveryActions: [],
    updatedAt: null,
  };
}

function completedCall({ runId, type, spendNanoUsd }) {
  const callId = `${type}:${runId}`;
  return {
    callId,
    runId,
    type,
    configurationId: 'gemini-2.5-flash-baseline',
    requestHash: 'a'.repeat(64),
    liabilityNanoUsd: spendNanoUsd,
    spendNanoUsd,
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
    providerDurationMs: 1,
    resultAvailable: true,
    resolution: 'provider_response',
    resultCheckpoint: {
      relativePath: `.call-checkpoints/${'a'.repeat(64)}.json`,
      sha256: 'a'.repeat(64),
    },
    completedAt: '2026-08-13T00:00:00.000Z',
  };
}

async function ledgerFixture(t, ledger = zeroLedger()) {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-spend-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(fixtureRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repoRoot: fixtureRoot, ledgerPath };
}

function budgetedOptions(context, type, runId, actualUsd) {
  const configuration = selectConfigurations('gemini-2.5-flash-baseline')[0];
  const tokenLimits = MIGRATION_TOKEN_LIMITS[type];
  return {
    ...context,
    budgetUsd: 10,
    type,
    runId,
    configuration,
    tokenLimits,
    request: {
      model: configuration.model,
      contents: 'Local fixture',
      config: { maxOutputTokens: tokenLimits.maxOutputTokens },
    },
    requestContext: {
      harnessVersion: 'local-test-v1',
      schemaVersion: 'local-test-schema-v1',
      corpusSourceIdentity: 'eval-utils-fixture',
      repeat: 1,
      direction: null,
      moreIdeasRound: null,
      operation: type,
      ...(type === 'evaluation' ? { evaluatorVersion: 'local-evaluator-v1' } : {}),
    },
    actualUsd: () => actualUsd,
  };
}

test('CLI configuration selection accepts only explicit allow-listed IDs in requested order', () => {
  const selected = selectConfigurations('gemini-3.6-flash-medium,gemini-2.5-flash-baseline');

  assert.deepEqual(selected.map(({ id }) => id), [
    'gemini-3.6-flash-medium',
    'gemini-2.5-flash-baseline',
  ]);
  assert.throws(() => selectConfigurations(''), /explicit.*configuration/i);
  assert.throws(() => selectConfigurations('gemini-unlisted'), /unknown.*configuration/i);
});

test('all expands to exactly the four migration configurations', () => {
  assert.deepEqual(ALL_CONFIGURATION_IDS, [
    'gemini-2.5-flash-baseline',
    'gemini-3.5-flash-lite-minimal',
    'gemini-3.6-flash-minimal',
    'gemini-3.6-flash-medium',
  ]);
  assert.deepEqual(selectConfigurations('all').map(({ id }) => id), ALL_CONFIGURATION_IDS);
});

test('migration corpus imports every named source case once and records provenance', async () => {
  const corpus = await loadMigrationCorpus(manifestPath);
  const importedBySource = Object.fromEntries(corpus.imports.map((item) => [item.path, item.importedCount]));

  assert.deepEqual(importedBySource, {
    'evals/human-calibration-set.json': 40,
    'evals/gemini-translation-prompt-set.json': 43,
    'evals/get-more-ideas-prompt-set.json': 4,
    'evals/variation-prompt-set.json': 15,
  });
  assert.equal(corpus.importedCount, 102);
  assert.equal(new Set(corpus.cases.map(({ id }) => id)).size, corpus.cases.length);
  assert.ok(corpus.cases.every(({ provenance }) => provenance.length >= 1));
  assert.deepEqual(
    corpus.cases.find(({ id }) => id === 'default-short-transition').provenance,
    [{ source: 'evals/gemini-translation-prompt-set.json', stableId: 'default-short-transition' }],
  );
  const noInterestGuardrails = corpus.cases
    .filter((item) => item.tone === 'Interest Based' && !item.interest);
  assert.deepEqual(noInterestGuardrails.map(({ id }) => id).sort(), [
    'current-31-dinner-hands-interest-missing-standard',
    'interest-based-missing-interest-fallback',
    'variation-interest-missing-fallback',
  ]);
  assert.ok(noInterestGuardrails.every(({ localOnly }) => localOnly));
});

test('evaluation plan honors repeat count for every selected configuration and remote case', () => {
  const plan = buildEvaluationPlan({
    cases: [
      { id: 'case-a', operation: 'translation' },
      { id: 'case-b', operation: 'translation' },
    ],
    configurations: selectConfigurations('gemini-2.5-flash-baseline,gemini-3.6-flash-medium'),
    repeats: 3,
    seed: 17,
  });

  assert.equal(plan.calls.length, 12);
  assert.deepEqual(
    [...new Set(plan.calls.map(({ repeat }) => repeat))].sort(),
    [1, 2, 3],
  );
});

test('evaluation plan ordering is deterministic for a seed and changes with a different seed', () => {
  const input = {
    cases: ['a', 'b', 'c', 'd'].map((id) => ({ id, operation: 'translation' })),
    configurations: selectConfigurations('gemini-2.5-flash-baseline'),
    repeats: 2,
  };
  const runKeys = (seed) => buildEvaluationPlan({ ...input, seed }).calls.map(({ runId }) => runId);

  assert.deepEqual(runKeys(8675309), runKeys(8675309));
  assert.notDeepEqual(runKeys(8675309), runKeys(42));
});

test('local-only cases are excluded from every model call', () => {
  const plan = buildEvaluationPlan({
    cases: [
      { id: 'remote', operation: 'translation' },
      { id: 'interest-based-missing-interest-fallback', operation: 'translation', localOnly: true },
    ],
    configurations: selectConfigurations('all'),
    repeats: 3,
    seed: 1,
  });

  assert.equal(plan.calls.length, 12);
  assert.ok(plan.calls.every(({ caseId }) => caseId === 'remote'));
  assert.deepEqual(plan.localChecks.map(({ caseId }) => caseId), ['interest-based-missing-interest-fallback']);
});

test('artifact names are timestamped under the migration directory with migration-only latest pointers', () => {
  assert.deepEqual(
    buildArtifactPaths({
      resultsDir: '/repo/evals/results/gemini-migration',
      baseName: 'model-bakeoff',
      now: new Date('2026-08-13T15:04:05.678Z'),
    }),
    {
      json: '/repo/evals/results/gemini-migration/model-bakeoff-2026-08-13T15-04-05-678Z.json',
      markdown: '/repo/evals/results/gemini-migration/model-bakeoff-2026-08-13T15-04-05-678Z.md',
      latestJson: '/repo/evals/results/gemini-migration/latest-model-bakeoff.json',
      latestMarkdown: '/repo/evals/results/gemini-migration/latest-model-bakeoff.md',
    },
  );
});

test('candidate metadata captures the exact effective model, thinking, pricing, and allow-list state', () => {
  assert.deepEqual(captureConfigurationMetadata(selectConfigurations('gemini-3.6-flash-medium')[0]), {
    id: 'gemini-3.6-flash-medium',
    model: 'gemini-3.6-flash',
    thinkingConfig: { thinkingLevel: 'medium' },
    inputUsdPerMillion: 1.5,
    outputUsdPerMillion: 7.5,
    pricingVerifiedOn: '2026-08-13',
    pricingNote: 'Gemini 3.6 Flash standard paid pricing verified against official Gemini docs on 2026-08-13.',
    productionAllowed: true,
  });
});

test('cost calculation bills visible candidates and thinking tokens as output', () => {
  const configuration = selectConfigurations('gemini-3.5-flash-lite-minimal')[0];

  assert.equal(calculateUsageCost(configuration, {
    promptTokenCount: 1_000_000,
    candidatesTokenCount: 200_000,
    thoughtsTokenCount: 300_000,
    totalTokenCount: 9_000_000,
  }), 1.55);
});

test('generation and evaluator calls accumulate separately in one persistent ledger', async (t) => {
  const context = await ledgerFixture(t);

  await runBudgetedCall({
    ...budgetedOptions(context, 'generation', 'generation-1', 1.55),
    call: async () => ({ usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 200_000, thoughtsTokenCount: 300_000 } }),
    tokenLimits: { maxInputTokens: 1_000_000, maxOutputTokens: 500_000 },
    request: { model: 'gemini-2.5-flash', contents: 'x', config: { maxOutputTokens: 500_000 } },
  });
  await runBudgetedCall({
    ...budgetedOptions(context, 'evaluation', 'evaluation-1', 0.02),
    call: async () => ({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 } }),
  });

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.deepEqual(ledger.generation, { calls: 1, spendNanoUsd: 1_550_000_000 });
  assert.deepEqual(ledger.evaluation, { calls: 1, spendNanoUsd: 20_000_000 });
  assert.equal(ledger.totalSpendNanoUsd, 1_570_000_000);
  assert.equal(ledger.reservedNanoUsd, 0);
});

test('a new process view recovers cumulative smoke and full-run spend from disk', async (t) => {
  const context = await ledgerFixture(t);

  await runBudgetedCall({
    ...budgetedOptions(context, 'generation', 'smoke', 0.01),
    call: async () => ({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 0 } }),
  });
  const afterSmoke = JSON.parse(await readFile(context.ledgerPath, 'utf8'));
  assert.equal(afterSmoke.totalSpendNanoUsd, 10_000_000);

  await runBudgetedCall({
    ...budgetedOptions(context, 'generation', 'full', 0.01),
    call: async () => ({ usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 0 } }),
  });
  const afterRestart = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.deepEqual(afterRestart.generation, { calls: 2, spendNanoUsd: 20_000_000 });
  assert.equal(afterRestart.totalSpendNanoUsd, 20_000_000);
});

test('aggregate gates report errors, checks, latency, token classes, and both spend types', () => {
  const metrics = calculateAggregateMetrics([
    {
      status: 'success', durationMs: 100, parseError: false, contractError: false, safetyFlags: [],
      useFewerWords: true, fewerWordsCompliant: true, interest: 'Minecraft', interestLeakage: false, interestGrounded: true,
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 3, totalTokenCount: 17 },
      generationUsd: 0.01, evaluatorUsd: 0.02,
    },
    {
      status: 'success', durationMs: 200, parseError: false, contractError: true, safetyFlags: ['SAFETY'],
      useFewerWords: true, fewerWordsCompliant: false, interest: 'Disney', interestLeakage: true, interestGrounded: false,
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 5, thoughtsTokenCount: 2, totalTokenCount: 27 },
      generationUsd: 0.03, evaluatorUsd: 0.04,
    },
    {
      status: 'error', durationMs: 900, parseError: true, contractError: false, safetyFlags: [],
      useFewerWords: false, usageMetadata: null, generationUsd: 0, evaluatorUsd: 0,
    },
  ]);

  assert.deepEqual(metrics, {
    runs: 3,
    successfulRuns: 2,
    requestErrors: 1,
    parseErrors: 1,
    contractErrors: 1,
    safetyFlags: 1,
    fewerWords: { checked: 2, compliant: 1 },
    interest: { checked: 2, leakage: 1, grounded: 1 },
    latencyMs: { median: 200, p95: 900 },
    tokens: { prompt: 30, visibleCandidates: 9, thoughts: 5, billedOutput: 14, total: 44 },
    spendUsd: {
      successfulRequests: 0.04,
      costPerSuccessfulRequest: 0.02,
      evaluator: 0.06,
      generationAndEvaluation: 0.1,
    },
  });
});

test('aggregate gate calculation enforces quality thresholds independently for each repeat', async () => {
  const { calculateAggregateGates } = await import('../scripts/gemini-migration-eval-utils.mjs');
  const rows = [
    { candidateId: 'candidate-a', repeat: 1, isCalibrationCase: true, postprocessedVerdict: 'Pass', safetyFlags: [] },
    { candidateId: 'candidate-a', repeat: 1, isCalibrationCase: true, postprocessedVerdict: 'Pass', safetyFlags: [] },
    { candidateId: 'candidate-a', repeat: 1, isCalibrationCase: true, postprocessedVerdict: 'Borderline', safetyFlags: [] },
  ];

  assert.deepEqual(calculateAggregateGates(rows, { minimumPasses: 2, maximumBorderline: 1 }), [{
    candidateId: 'candidate-a',
    repeat: 1,
    calibrationRuns: 3,
    verdicts: { Pass: 2, Borderline: 1, Fail: 0, Unknown: 0 },
    requestErrors: 0,
    parseErrors: 0,
    contractErrors: 0,
    safetyFlags: 0,
    criticalSafetyOrSequenceOmissions: 0,
    interestGroundingViolations: 0,
    crossInterestLeakage: 0,
    fewerWordsFailures: 0,
    evaluated: true,
    passesAll: true,
  }]);

  const failed = calculateAggregateGates([
    ...rows,
    { candidateId: 'candidate-a', repeat: 1, isCalibrationCase: false, postprocessedVerdict: 'Pass', contractError: true, safetyFlags: [] },
  ], { minimumPasses: 2, maximumBorderline: 1 });
  assert.equal(failed[0].passesAll, false);
  assert.equal(failed[0].contractErrors, 1);
});

test('pre-call ledger reservation stops before a call that could cross the cumulative cap', async (t) => {
  const ledger = {
    ...zeroLedger(),
    generation: { calls: 1, spendNanoUsd: 9_990_000_000 },
    totalSpendNanoUsd: 9_990_000_000,
    completedCalls: {
      'generation:historical': completedCall({
        runId: 'historical', type: 'generation', spendNanoUsd: 9_990_000_000,
      }),
    },
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
  const context = await ledgerFixture(t, ledger);
  let called = false;

  await assert.rejects(
    runBudgetedCall({
      ...budgetedOptions(context, 'evaluation', 'near-cap', 0.01),
      call: async () => { called = true; return { usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 0 } }; },
    }),
    /phase 3.*budget.*before evaluation call/i,
  );
  assert.equal(called, false);
  assert.deepEqual(await readSpendLedger({ ...context, budgetUsd: 10 }), ledger);
});
