import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  NANO_USD_PER_USD,
  readSpendLedger,
  runBudgetedCall,
  selectConfigurations,
  summarizeSpendLedger,
} from '../scripts/gemini-migration-eval-utils.mjs';
import { renderBakeoffMarkdown } from '../scripts/run-model-bakeoff.mjs';

const durabilityTest = (name, callback) => test(name, { timeout: 5_000 }, callback);
const baseline = selectConfigurations('gemini-2.5-flash-baseline')[0];
const tinyLimits = { maxInputTokens: 16, maxOutputTokens: 1 };

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

function legacyZeroLedger() {
  return {
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
}

async function fixture(t, ledger = zeroLedger()) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-durable-ledger-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repoRoot, ledgerPath };
}

function response(text = 'private output') {
  return {
    text,
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
  const type = overrides.type ?? 'generation';
  const runId = overrides.runId ?? 'stable-call';
  return {
    ...context,
    budgetUsd: 10,
    type,
    runId,
    configuration: baseline,
    tokenLimits: tinyLimits,
    request: {
      model: baseline.model,
      contents: 'x',
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: tinyLimits.maxOutputTokens,
      },
    },
    requestContext: {
      harnessVersion: 'local-test-v1',
      schemaVersion: 'local-test-schema-v1',
      corpusSourceIdentity: 'durability-fixture',
      repeat: 1,
      direction: null,
      moreIdeasRound: null,
      operation: type,
      ...(type === 'evaluation' ? { evaluatorVersion: 'local-evaluator-v1' } : {}),
    },
    serializeResult: (value) => ({
      text: value.text,
      usageMetadata: value.usageMetadata,
      candidates: value.candidates,
    }),
    call: async () => response(),
    ...overrides,
  };
}

durabilityTest('only the exact committed schema-3 zero state migrates to the request-bound ledger', async (t) => {
  const context = await fixture(t, legacyZeroLedger());

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });

  assert.deepEqual(ledger, zeroLedger());
  assert.equal(JSON.parse(await readFile(context.ledgerPath, 'utf8')).schemaVersion, 4);

  const activeLegacy = {
    ...legacyZeroLedger(),
    generation: { calls: 1, spendNanoUsd: 10_000_000 },
    totalSpendNanoUsd: 10_000_000,
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
  const activeContext = await fixture(t, activeLegacy);
  await assert.rejects(
    readSpendLedger({ ...activeContext, budgetUsd: 10 }),
    /only.*zero.*migrat|invalid.*schema/i,
  );
});

durabilityTest('ledger validation rejects completed spend above its reserved liability', async (t) => {
  const context = await fixture(t);
  await runBudgetedCall(options(context, { runId: 'tamper-liability' }));
  const ledger = JSON.parse(await readFile(context.ledgerPath, 'utf8'));
  ledger.completedCalls['generation:tamper-liability'].liabilityNanoUsd = 299;
  await writeFile(context.ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);

  await assert.rejects(
    readSpendLedger({ ...context, budgetUsd: 10 }),
    /spend.*liability/i,
  );
});

durabilityTest('a single sub-micro-dollar charge consumes integer budget', async (t) => {
  const context = await fixture(t);

  await runBudgetedCall(options(context, { runId: 'one-input-token' }));

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(NANO_USD_PER_USD, 1_000_000_000);
  assert.equal(ledger.generation.spendNanoUsd, 300);
  assert.equal(ledger.totalSpendNanoUsd, 300);
  assert.equal(ledger.completedCalls['generation:one-input-token'].spendNanoUsd, 300);
  assert.equal(ledger.reservedNanoUsd, 0);
});

durabilityTest('many tiny positive calls all consume budget and cannot cross the integer cap', async (t) => {
  const context = await fixture(t);

  for (let index = 0; index < 20; index += 1) {
    await runBudgetedCall(options(context, { runId: `tiny-${index}` }));
  }

  const accumulated = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(accumulated.generation.calls, 20);
  assert.equal(accumulated.generation.spendNanoUsd, 6_000);
  assert.equal(Object.keys(accumulated.completedCalls).length, 20);

  const liabilityNanoUsd = 7_300;
  const nearCapLedger = {
    ...zeroLedger(),
    generation: { calls: 1, spendNanoUsd: 10_000_000_000 - liabilityNanoUsd },
    totalSpendNanoUsd: 10_000_000_000 - liabilityNanoUsd,
    completedCalls: {
      'generation:historical': {
        callId: 'generation:historical',
        runId: 'historical',
        type: 'generation',
        configurationId: baseline.id,
        requestHash: 'a'.repeat(64),
        liabilityNanoUsd: 10_000_000_000 - liabilityNanoUsd,
        spendNanoUsd: 10_000_000_000 - liabilityNanoUsd,
        usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
        providerDurationMs: 1,
        resultAvailable: true,
        resolution: 'provider_response',
        resultCheckpoint: { relativePath: `.call-checkpoints/${'a'.repeat(64)}.json`, sha256: 'a'.repeat(64) },
        completedAt: '2026-08-13T00:00:00.000Z',
      },
    },
    updatedAt: '2026-08-13T00:00:00.000Z',
  };
  const nearCap = await fixture(t, nearCapLedger);
  await runBudgetedCall(options(nearCap, { runId: 'last-fitting-call' }));
  let callbackCount = 0;
  await assert.rejects(
    runBudgetedCall(options(nearCap, {
      runId: 'over-cap-call',
      call: async () => { callbackCount += 1; return response(); },
    })),
    /budget stop before generation call/i,
  );
  const finalLedger = await readSpendLedger({ ...nearCap, budgetUsd: 10 });
  assert.equal(callbackCount, 0);
  assert.ok(finalLedger.totalSpendNanoUsd + finalLedger.reservedNanoUsd <= finalLedger.budgetNanoUsd);
});

for (const boundary of ['afterDispatchRecord', 'afterProviderResponse', 'afterResultCheckpoint']) {
  durabilityTest(`${boundary} fault preserves ambiguous liability and forbids a second callback`, async (t) => {
    const context = await fixture(t);
    let callbackCount = 0;
    const call = async () => { callbackCount += 1; return response(); };

    await assert.rejects(
      runBudgetedCall(options(context, {
        runId: boundary,
        call,
        faultInjection: {
          [boundary]: () => { throw new Error(`fault:${boundary}`); },
        },
      })),
      new RegExp(`fault:${boundary}`),
    );

    const expectedCallbacks = boundary === 'afterDispatchRecord' ? 0 : 1;
    assert.equal(callbackCount, expectedCallbacks);
    const interrupted = await readSpendLedger({ ...context, budgetUsd: 10 });
    assert.equal(interrupted.pendingReservations.length, 1);
    assert.ok(['dispatched', 'unresolved'].includes(interrupted.pendingReservations[0].status));
    assert.equal(Object.keys(interrupted.completedCalls).length, 0);

    await assert.rejects(
      runBudgetedCall(options(context, { runId: boundary, call })),
      /unresolved spend liability|already.*pending/i,
    );
    assert.equal(callbackCount, expectedCallbacks);
  });
}

for (const type of ['generation', 'evaluation']) {
  durabilityTest(`${type} replays the durable completed result after a post-settlement crash`, async (t) => {
    const context = await fixture(t);
    let callbackCount = 0;
    const call = async () => { callbackCount += 1; return response(`${type} private output`); };

    await assert.rejects(
      runBudgetedCall(options(context, {
        type,
        runId: 'post-settlement',
        call,
        faultInjection: {
          afterSettlement: () => { throw new Error('fault:afterSettlement'); },
        },
      })),
      /fault:afterSettlement/,
    );

    const settled = await readSpendLedger({ ...context, budgetUsd: 10 });
    const callId = `${type}:post-settlement`;
    assert.equal(settled.completedCalls[callId].spendNanoUsd, 300);
    assert.equal(settled.pendingReservations.length, 0);
    assert.doesNotMatch(JSON.stringify(settled), /private output/);
    const checkpointPath = path.join(
      path.dirname(context.ledgerPath),
      settled.completedCalls[callId].resultCheckpoint.relativePath,
    );
    assert.equal((await stat(path.dirname(checkpointPath))).mode & 0o777, 0o700);
    assert.equal((await stat(checkpointPath)).mode & 0o777, 0o600);

    const replayed = await runBudgetedCall(options(context, { type, runId: 'post-settlement', call }));
    assert.equal(replayed.text, `${type} private output`);
    assert.equal(callbackCount, 1);
  });
}

durabilityTest('a completed stable call ID is replayed without provider dispatch after checkpoint', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;
  const first = await runBudgetedCall(options(context, {
    runId: 'checkpointed',
    call: async () => { callbackCount += 1; return response('checkpointed private output'); },
  }));
  assert.equal(first.text, 'checkpointed private output');

  const replayed = await runBudgetedCall(options(context, {
    runId: 'checkpointed',
    call: async () => { callbackCount += 1; throw new Error('must not dispatch'); },
  }));

  assert.equal(replayed.text, 'checkpointed private output');
  assert.equal(callbackCount, 1);
});

durabilityTest('machine and Markdown reports expose settled spend and committed liabilities by type', () => {
  const ledger = {
    ...zeroLedger(),
    generation: { calls: 1, spendNanoUsd: 1_000_000_000 },
    evaluation: { calls: 1, spendNanoUsd: 500_000_000 },
    totalSpendNanoUsd: 1_500_000_000,
    reservedNanoUsd: 1_000_000_000,
    pendingReservations: [
      {
        id: 'g-reserved', callId: 'generation:g', runId: 'g', type: 'generation', status: 'reserved',
        liabilityNanoUsd: 250_000_000, ownerPid: 1, ownerToken: 'a', configurationId: baseline.id,
        requestHash: 'c'.repeat(64),
        maxInputTokens: 1, maxOutputTokens: 1, createdAt: '2026-08-13T00:00:00.000Z',
      },
      {
        id: 'e-unresolved', callId: 'evaluation:e', runId: 'e', type: 'evaluation', status: 'unresolved',
        liabilityNanoUsd: 750_000_000, ownerPid: 2, ownerToken: 'b', configurationId: baseline.id,
        requestHash: 'd'.repeat(64),
        maxInputTokens: 1, maxOutputTokens: 1, createdAt: '2026-08-13T00:00:00.000Z',
        dispatchedAt: '2026-08-13T00:00:01.000Z', unresolvedAt: '2026-08-13T00:00:02.000Z', reason: 'test',
      },
    ],
    completedCalls: {
      'generation:done': {
        callId: 'generation:done', runId: 'done', type: 'generation', configurationId: baseline.id,
        requestHash: 'a'.repeat(64), liabilityNanoUsd: 1_000_000_000,
        spendNanoUsd: 1_000_000_000,
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
        providerDurationMs: 1, resultAvailable: true, resolution: 'provider_response',
        resultCheckpoint: { relativePath: `.call-checkpoints/${'a'.repeat(64)}.json`, sha256: 'a'.repeat(64) },
        completedAt: '2026-08-13T00:00:00.000Z',
      },
      'evaluation:done': {
        callId: 'evaluation:done', runId: 'done', type: 'evaluation', configurationId: baseline.id,
        requestHash: 'b'.repeat(64), liabilityNanoUsd: 500_000_000,
        spendNanoUsd: 500_000_000,
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 0, thoughtsTokenCount: 0 },
        providerDurationMs: 1, resultAvailable: true, resolution: 'provider_response',
        resultCheckpoint: { relativePath: `.call-checkpoints/${'b'.repeat(64)}.json`, sha256: 'b'.repeat(64) },
        completedAt: '2026-08-13T00:00:00.000Z',
      },
    },
    updatedAt: '2026-08-13T00:00:02.000Z',
  };

  const spend = summarizeSpendLedger(ledger);
  assert.equal(spend.generation.settledUsd, 1);
  assert.equal(spend.generation.reservedLiabilityUsd, 0.25);
  assert.equal(spend.evaluation.settledUsd, 0.5);
  assert.equal(spend.evaluation.unresolvedLiabilityUsd, 0.75);
  assert.equal(spend.totalCommittedUsd, 2.5);
  assert.equal(spend.remainingCapacityUsd, 7.5);
  assert.deepEqual(spend.pendingCounts, {
    total: 2,
    generation: 1,
    evaluation: 1,
    reserved: 1,
    dispatched: 0,
    unresolved: 1,
  });

  const markdown = renderBakeoffMarkdown({
    generatedAt: '2026-08-13T00:00:00.000Z',
    candidates: [],
    results: [],
    summary: [],
    localChecks: [],
    cumulativeSpend: spend,
    qualityScored: false,
  });
  assert.match(markdown, /settled.*generation \$1.*evaluation \$0\.5.*total \$1\.5/i);
  assert.match(markdown, /liabilit.*generation \$0\.25.*evaluation \$0\.75.*total \$1/i);
  assert.match(markdown, /committed \$2\.5.*remaining.*\$7\.5.*pending 2/i);
});
