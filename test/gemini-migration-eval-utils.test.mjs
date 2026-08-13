import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALL_CONFIGURATION_IDS,
  buildArtifactPaths,
  buildEvaluationPlan,
  calculateAggregateMetrics,
  calculateUsageCost,
  captureConfigurationMetadata,
  createInitialSpendLedger,
  loadMigrationCorpus,
  readSpendLedger,
  runBudgetedCall,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(repoRoot, 'evals', 'gemini-migration-prompt-set.json');

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
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-spend-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const ledgerPath = path.join(temporaryDirectory, 'phase-3-spend.json');
  await writeFile(ledgerPath, `${JSON.stringify(createInitialSpendLedger(10), null, 2)}\n`);

  await runBudgetedCall({
    ledgerPath,
    budgetUsd: 10,
    type: 'generation',
    estimatedUsd: 2,
    call: async () => ({ usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 200_000, thoughtsTokenCount: 300_000 } }),
    actualUsd: () => 1.55,
  });
  await runBudgetedCall({
    ledgerPath,
    budgetUsd: 10,
    type: 'evaluation',
    estimatedUsd: 0.7,
    call: async () => ({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 2 } }),
    actualUsd: () => 0.45,
  });

  const ledger = await readSpendLedger(ledgerPath, 10);
  assert.deepEqual(ledger.generation, { calls: 1, spendUsd: 1.55 });
  assert.deepEqual(ledger.evaluation, { calls: 1, spendUsd: 0.45 });
  assert.equal(ledger.totalSpendUsd, 2);
  assert.equal(ledger.reservedUsd, 0);
});

test('a new process view recovers cumulative smoke and full-run spend from disk', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-restart-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const ledgerPath = path.join(temporaryDirectory, 'phase-3-spend.json');
  await writeFile(ledgerPath, `${JSON.stringify(createInitialSpendLedger(10), null, 2)}\n`);

  await runBudgetedCall({
    ledgerPath,
    budgetUsd: 10,
    type: 'generation',
    estimatedUsd: 0.5,
    call: async () => ({}),
    actualUsd: () => 0.4,
  });
  const afterSmoke = JSON.parse(await readFile(ledgerPath, 'utf8'));
  assert.equal(afterSmoke.totalSpendUsd, 0.4);

  await runBudgetedCall({
    ledgerPath,
    budgetUsd: 10,
    type: 'generation',
    estimatedUsd: 0.7,
    call: async () => ({}),
    actualUsd: () => 0.6,
  });
  const afterRestart = await readSpendLedger(ledgerPath, 10);
  assert.deepEqual(afterRestart.generation, { calls: 2, spendUsd: 1 });
  assert.equal(afterRestart.totalSpendUsd, 1);
});

test('ledger persists actual response spend even when it is higher than the pre-call estimate', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-actual-spend-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const ledgerPath = path.join(temporaryDirectory, 'phase-3-spend.json');
  await writeFile(ledgerPath, `${JSON.stringify(createInitialSpendLedger(10), null, 2)}\n`);

  await runBudgetedCall({
    ledgerPath,
    budgetUsd: 10,
    type: 'generation',
    estimatedUsd: 0.5,
    call: async () => ({ usageMetadata: {} }),
    actualUsd: () => 0.6,
  });

  const ledger = await readSpendLedger(ledgerPath, 10);
  assert.deepEqual(ledger.generation, { calls: 1, spendUsd: 0.6 });
  assert.equal(ledger.totalSpendUsd, 0.6);
  assert.equal(ledger.reservedUsd, 0);
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
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-cap-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const ledgerPath = path.join(temporaryDirectory, 'phase-3-spend.json');
  const ledger = createInitialSpendLedger(10);
  ledger.generation = { calls: 9, spendUsd: 9.7 };
  ledger.evaluation = { calls: 2, spendUsd: 0.2 };
  ledger.totalSpendUsd = 9.9;
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  let called = false;

  await assert.rejects(
    runBudgetedCall({
      ledgerPath,
      budgetUsd: 10,
      type: 'evaluation',
      estimatedUsd: 0.11,
      call: async () => { called = true; },
      actualUsd: () => 0.01,
    }),
    /phase 3.*budget.*before evaluation call/i,
  );
  assert.equal(called, false);
  assert.deepEqual(await readSpendLedger(ledgerPath, 10), ledger);
});
