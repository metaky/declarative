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
  calculateAggregateMetrics,
  getProviderDurationMs,
  readSpendLedger,
  runBudgetedCall,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

const identityTest = (name, callback) => test(name, { timeout: 5_000 }, callback);
const baseline = selectConfigurations('gemini-2.5-flash-baseline')[0];
const alternative = selectConfigurations('gemini-3.5-flash-lite-minimal')[0];
const limits = { maxInputTokens: 512, maxOutputTokens: 8 };

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

async function fixture(t) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-request-identity-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(zeroLedger(), null, 2)}\n`);
  return { repoRoot, ledgerPath };
}

function providerResponse() {
  return {
    text: 'synthetic result',
    usageMetadata: {
      promptTokenCount: 1,
      candidatesTokenCount: 1,
      thoughtsTokenCount: 0,
      totalTokenCount: 2,
    },
    candidates: [{ finishReason: 'STOP' }],
  };
}

function callOptions(context, overrides = {}) {
  const configuration = overrides.configuration ?? baseline;
  return {
    ...context,
    budgetUsd: 10,
    type: 'generation',
    runId: 'stable-logical-call',
    configuration,
    tokenLimits: limits,
    request: {
      model: configuration.model,
      contents: 'prompt-a',
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: limits.maxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'STRING' } },
      },
    },
    requestContext: {
      harnessVersion: 'task-6-v3',
      schemaVersion: 'translation-array-v1',
      corpusSourceIdentity: 'corpus-a:case-a',
      repeat: 1,
      direction: 'formal',
      moreIdeasRound: 2,
      operation: 'variation',
    },
    serializeResult: (value) => ({
      text: value.text,
      usageMetadata: value.usageMetadata,
      candidates: value.candidates,
    }),
    call: async () => providerResponse(),
    ...overrides,
  };
}

identityTest('a completed call replays only for the exact canonical request identity and retains original provider latency', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  const timestamps = [1_000, 1_137];
  const options = callOptions(context, {
    nowMs: () => timestamps.shift(),
    call: async () => {
      callbackCount += 1;
      return providerResponse();
    },
  });

  const first = await runBudgetedCall(options);
  const replayed = await runBudgetedCall(callOptions(context, {
    call: async () => {
      callbackCount += 1;
      throw new Error('must not dispatch');
    },
  }));

  assert.equal(callbackCount, 1);
  assert.equal(getProviderDurationMs(first), 137);
  assert.equal(getProviderDurationMs(replayed), 137);
  const resumedMetrics = calculateAggregateMetrics([{
    status: 'success',
    durationMs: getProviderDurationMs(replayed),
    generationUsd: 0.0000003,
    evaluatorUsd: 0,
    usageMetadata: replayed.usageMetadata,
  }]);
  assert.equal(resumedMetrics.latencyMs.median, 137);
  assert.equal(resumedMetrics.latencyMs.p95, 137);
  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  const completed = ledger.completedCalls['generation:stable-logical-call'];
  assert.match(completed.requestHash, /^[a-f0-9]{64}$/);
  assert.equal(completed.providerDurationMs, 137);
  assert.doesNotMatch(JSON.stringify(ledger), /prompt-a|synthetic result/);
});

identityTest('prompt, effective config, schema, corpus, repeat, direction, and round changes fail closed without callback', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  await runBudgetedCall(callOptions(context, {
    call: async () => {
      callbackCount += 1;
      return providerResponse();
    },
  }));

  const base = callOptions(context);
  const variants = [
    { label: 'prompt', value: { request: { ...base.request, contents: 'prompt-b' } } },
    {
      label: 'effective config',
      value: { request: { ...base.request, config: { ...base.request.config, temperature: 0.7 } } },
    },
    {
      label: 'schema',
      value: {
        request: {
          ...base.request,
          config: { ...base.request.config, responseSchema: { type: 'OBJECT' } },
        },
      },
    },
    {
      label: 'configuration ID and model',
      value: {
        configuration: alternative,
        request: { ...base.request, model: alternative.model },
      },
    },
    {
      label: 'corpus',
      value: { requestContext: { ...base.requestContext, corpusSourceIdentity: 'corpus-b:case-a' } },
    },
    { label: 'repeat', value: { requestContext: { ...base.requestContext, repeat: 2 } } },
    { label: 'direction', value: { requestContext: { ...base.requestContext, direction: 'casual' } } },
    { label: 'round', value: { requestContext: { ...base.requestContext, moreIdeasRound: 3 } } },
  ];

  for (const variant of variants) {
    await assert.rejects(
      runBudgetedCall(callOptions(context, {
        ...variant.value,
        call: async () => {
          callbackCount += 1;
          return providerResponse();
        },
      })),
      /request identity mismatch/i,
      variant.label,
    );
  }
  assert.equal(callbackCount, 1);
});

identityTest('an effective request model that differs from the priced configuration is rejected before callback', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  const base = callOptions(context);

  await assert.rejects(runBudgetedCall(callOptions(context, {
    request: { ...base.request, model: alternative.model },
    call: async () => { callbackCount += 1; return providerResponse(); },
  })), /request model.*configuration model/i);
  assert.equal(callbackCount, 0);
});

identityTest('request identity rejects missing required source and attempt context before callback', async (t) => {
  const context = await fixture(t);
  const base = callOptions(context);
  const incompleteContext = { ...base.requestContext };
  delete incompleteContext.corpusSourceIdentity;
  let callbackCount = 0;

  await assert.rejects(runBudgetedCall(callOptions(context, {
    requestContext: incompleteContext,
    call: async () => { callbackCount += 1; return providerResponse(); },
  })), /corpusSourceIdentity/i);
  assert.equal(callbackCount, 0);
});

identityTest('request identity rejects present-but-undefined required context before callback', async (t) => {
  const context = await fixture(t);
  const base = callOptions(context);
  let callbackCount = 0;

  await assert.rejects(runBudgetedCall(callOptions(context, {
    requestContext: { ...base.requestContext, corpusSourceIdentity: undefined },
    call: async () => { callbackCount += 1; return providerResponse(); },
  })), /corpusSourceIdentity/i);
  assert.equal(callbackCount, 0);
});

identityTest('a pending reservation stores the request hash and rejects a changed request before callback', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  await assert.rejects(runBudgetedCall(callOptions(context, {
    faultInjection: { afterDispatchRecord: () => { throw new Error('stop after dispatch record'); } },
    call: async () => { callbackCount += 1; return providerResponse(); },
  })), /stop after dispatch record/);
  const pending = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.match(pending.pendingReservations[0].requestHash, /^[a-f0-9]{64}$/);

  const base = callOptions(context);
  await assert.rejects(runBudgetedCall(callOptions(context, {
    request: { ...base.request, contents: 'changed while pending' },
    call: async () => { callbackCount += 1; return providerResponse(); },
  })), /request identity mismatch/i);
  assert.equal(callbackCount, 0);
});
