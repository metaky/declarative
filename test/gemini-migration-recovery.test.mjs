import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  calculateCallUpperBoundNanoUsd,
  readSpendLedger,
  recoverAmbiguousCall,
  runBudgetedCall,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

const recoveryTest = (name, callback) => test(name, { timeout: 5_000 }, callback);
const configuration = selectConfigurations('gemini-2.5-flash-baseline')[0];
const limits = { maxInputTokens: 64, maxOutputTokens: 2 };
const requestContext = {
  harnessVersion: 'task-6-request-v1',
  schemaVersion: 'synthetic-v1',
  corpusSourceIdentity: 'local-recovery-fixture',
  repeat: 1,
  direction: null,
  moreIdeasRound: null,
  operation: 'translation',
};

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

async function fixture(t, ledger = zeroLedger()) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-recovery-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repoRoot, ledgerPath };
}

function response() {
  return {
    text: 'synthetic recovery result',
    usageMetadata: {
      promptTokenCount: 1,
      candidatesTokenCount: 0,
      thoughtsTokenCount: 0,
      totalTokenCount: 1,
    },
    candidates: [{ finishReason: 'STOP' }],
  };
}

function options(context, overrides = {}) {
  return {
    ...context,
    budgetUsd: 10,
    type: 'generation',
    runId: 'ambiguous-call',
    configuration,
    tokenLimits: limits,
    request: {
      model: configuration.model,
      contents: 'synthetic recovery prompt',
      config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: limits.maxOutputTokens },
    },
    requestContext,
    serializeResult: (value) => ({
      text: value.text,
      usageMetadata: value.usageMetadata,
      candidates: value.candidates,
    }),
    call: async () => response(),
    ...overrides,
  };
}

recoveryTest('ambiguous calls cannot retry until audited recovery settles the maximum and authorizes a distinct attempt', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  const call = async () => { callbackCount += 1; return response(); };
  await assert.rejects(runBudgetedCall(options(context, {
    call,
    faultInjection: { afterProviderResponse: () => { throw new Error('ambiguous crash'); } },
  })), /ambiguous crash/);

  await assert.rejects(runBudgetedCall(options(context, { call })), /unresolved spend liability/i);
  assert.equal(callbackCount, 1);
  const beforeDryRun = await readFile(context.ledgerPath, 'utf8');
  const preview = await recoverAmbiguousCall({
    ...context,
    budgetUsd: 10,
    callId: 'generation:ambiguous-call',
    reasonCode: 'provider-outcome-unknown',
    operatorId: 'operator-1',
    dryRun: true,
  });
  assert.equal(preview.retryRunId, 'ambiguous-call:retry-1');
  assert.equal(await readFile(context.ledgerPath, 'utf8'), beforeDryRun);

  const recovery = await recoverAmbiguousCall({
    ...context,
    budgetUsd: 10,
    callId: 'generation:ambiguous-call',
    reasonCode: 'provider-outcome-unknown',
    operatorId: 'operator-1',
  });
  const recovered = await readSpendLedger({ ...context, budgetUsd: 10 });
  const original = recovered.completedCalls['generation:ambiguous-call'];
  assert.equal(original.spendNanoUsd, calculateCallUpperBoundNanoUsd(configuration, limits));
  assert.equal(original.resultAvailable, false);
  assert.equal(original.resolution, 'operator-settled-upper-bound');
  assert.equal(recovered.pendingReservations.length, 0);
  assert.equal(recovered.recoveryActions.length, 1);
  assert.equal(recovered.recoveryActions[0].retryCallId, 'generation:ambiguous-call:retry-1');
  assert.doesNotMatch(JSON.stringify(recovered), /synthetic recovery prompt|synthetic recovery result/);

  await assert.rejects(runBudgetedCall(options(context, { call })), /no replayable result|explicit recovery/i);
  assert.equal(callbackCount, 1);

  await runBudgetedCall(options(context, { runId: recovery.retryRunId, call }));
  const retried = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(callbackCount, 2);
  assert.equal(retried.generation.calls, 2);
  assert.equal(
    retried.totalSpendNanoUsd,
    original.liabilityNanoUsd + retried.completedCalls[recovery.retryCallId].spendNanoUsd,
  );
  assert.notEqual(original.requestHash, retried.completedCalls[recovery.retryCallId].requestHash);
  assert.equal(retried.recoveryActions[0].retryRequestHash, retried.completedCalls[recovery.retryCallId].requestHash);
});

recoveryTest('a damaged completed checkpoint requires explicit recovery and never auto-dispatches', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  const call = async () => { callbackCount += 1; return response(); };
  await runBudgetedCall(options(context, { runId: 'damaged-call', call }));
  const settled = await readSpendLedger({ ...context, budgetUsd: 10 });
  const completed = settled.completedCalls['generation:damaged-call'];
  const checkpointPath = path.join(path.dirname(context.ledgerPath), completed.resultCheckpoint.relativePath);
  await writeFile(checkpointPath, '{"tampered":true}\n');

  await assert.rejects(
    runBudgetedCall(options(context, { runId: 'damaged-call', call })),
    /checkpoint integrity/i,
  );
  assert.equal(callbackCount, 1);

  const recovery = await recoverAmbiguousCall({
    ...context,
    budgetUsd: 10,
    callId: 'generation:damaged-call',
    reasonCode: 'checkpoint-damaged',
    operatorId: 'operator-2',
  });
  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(ledger.completedCalls['generation:damaged-call'].resultAvailable, false);
  assert.equal(
    ledger.completedCalls['generation:damaged-call'].spendNanoUsd,
    ledger.completedCalls['generation:damaged-call'].liabilityNanoUsd,
  );
  assert.equal(recovery.retryRunId, 'damaged-call:retry-1');
  assert.equal(callbackCount, 1);
});

recoveryTest('recovery plus a fresh retry reservation cannot exceed the ten-dollar committed cap', async (t) => {
  const liabilityNanoUsd = calculateCallUpperBoundNanoUsd(configuration, limits);
  const historicalSpend = 10_000_000_000 - liabilityNanoUsd;
  const historical = {
    callId: 'generation:historical',
    runId: 'historical',
    type: 'generation',
    configurationId: configuration.id,
    requestHash: 'a'.repeat(64),
    liabilityNanoUsd: historicalSpend,
    spendNanoUsd: historicalSpend,
    usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
    providerDurationMs: 1,
    resultAvailable: true,
    resolution: 'provider_response',
    resultCheckpoint: { relativePath: `.call-checkpoints/${'a'.repeat(64)}.json`, sha256: 'a'.repeat(64) },
    completedAt: '2026-08-13T00:00:00.000Z',
  };
  const context = await fixture(t, {
    ...zeroLedger(),
    generation: { calls: 1, spendNanoUsd: historicalSpend },
    totalSpendNanoUsd: historicalSpend,
    completedCalls: { [historical.callId]: historical },
    updatedAt: '2026-08-13T00:00:00.000Z',
  });
  let callbackCount = 0;
  await assert.rejects(runBudgetedCall(options(context, {
    call: async () => { callbackCount += 1; return response(); },
    faultInjection: { afterDispatchRecord: () => { throw new Error('ambiguous near cap'); } },
  })), /ambiguous near cap/);
  const recovery = await recoverAmbiguousCall({
    ...context,
    budgetUsd: 10,
    callId: 'generation:ambiguous-call',
    reasonCode: 'settlement-interrupted',
    operatorId: 'operator-3',
  });

  await assert.rejects(
    runBudgetedCall(options(context, {
      runId: recovery.retryRunId,
      call: async () => { callbackCount += 1; return response(); },
    })),
    /budget stop/i,
  );
  const finalLedger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(callbackCount, 0);
  assert.equal(finalLedger.totalSpendNanoUsd, finalLedger.budgetNanoUsd);
  assert.equal(finalLedger.reservedNanoUsd, 0);
});
