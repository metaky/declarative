import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as migrationUtils from '../scripts/gemini-migration-eval-utils.mjs';
import {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  MIGRATION_TOKEN_LIMITS,
  calculateCallUpperBoundNanoUsd,
  readSpendLedger,
  reconcileSpendLedger,
  resolveCanonicalSpendLedgerPath,
  runBudgetedCall,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

function zeroLedger() {
  return {
    schemaVersion: 5,
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

function completedCall({ runId, spendNanoUsd }) {
  const callId = `generation:${runId}`;
  return {
    callId,
    runId,
    type: 'generation',
    configurationId: configuration.id,
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

async function fixture(t, ledger = zeroLedger()) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-ledger-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repoRoot, ledgerPath };
}

const configuration = selectConfigurations('gemini-3.6-flash-medium')[0];
const limits = MIGRATION_TOKEN_LIMITS.generation;
const safetyTest = (name, callback) => test(name, { timeout: 5_000 }, callback);

function boundedRequest(contents = 'Translate this bounded local fixture.') {
  return {
    model: configuration.model,
    contents,
    config: { maxOutputTokens: limits.maxOutputTokens },
  };
}

function validUsage(overrides = {}) {
  return {
    promptTokenCount: 10,
    candidatesTokenCount: 5,
    thoughtsTokenCount: 3,
    totalTokenCount: 18,
    ...overrides,
  };
}

function callOptions(context, overrides = {}) {
  const request = overrides.request ?? boundedRequest();
  return {
    ...context,
    budgetUsd: 10,
    type: 'generation',
    runId: overrides.runId ?? 'config:case:repeat-1',
    configuration,
    tokenLimits: limits,
    request,
    requestContext: {
      harnessVersion: 'local-test-v1',
      schemaVersion: 'local-test-schema-v1',
      corpusSourceIdentity: 'spend-safety-fixture',
      repeat: 1,
      direction: null,
      moreIdeasRound: null,
      operation: 'generation',
    },
    call: overrides.call ?? (async () => ({ usageMetadata: validUsage() })),
    ...overrides,
    request,
  };
}

safetyTest('the harness exposes no ledger create, initialize, or reset route', () => {
  assert.equal('createInitialSpendLedger' in migrationUtils, false);
  assert.equal('initializeSpendLedger' in migrationUtils, false);
  assert.equal('resetSpendLedger' in migrationUtils, false);
});

safetyTest('only the canonical Phase 3 ledger path is accepted', async (t) => {
  const context = await fixture(t);
  const alternate = path.join(context.repoRoot, 'alternate-spend.json');
  await writeFile(alternate, `${JSON.stringify(zeroLedger())}\n`);

  await assert.rejects(
    resolveCanonicalSpendLedgerPath({ repoRoot: context.repoRoot, requestedPath: alternate }),
    /canonical phase 3 spend ledger/i,
  );
  await assert.rejects(
    runBudgetedCall(callOptions({ ...context, ledgerPath: alternate })),
    /canonical phase 3 spend ledger/i,
  );
});

safetyTest('symlink aliases and a symlinked canonical ledger are rejected', async (t) => {
  const context = await fixture(t);
  const alias = path.join(context.repoRoot, 'ledger-alias.json');
  await symlink(context.ledgerPath, alias);
  await assert.rejects(
    resolveCanonicalSpendLedgerPath({ repoRoot: context.repoRoot, requestedPath: alias }),
    /canonical phase 3 spend ledger/i,
  );

  const backing = `${context.ledgerPath}.backing`;
  await writeFile(backing, await readFile(context.ledgerPath));
  await unlink(context.ledgerPath);
  await symlink(backing, context.ledgerPath);
  await assert.rejects(
    resolveCanonicalSpendLedgerPath(context),
    /symlink/i,
  );
});

safetyTest('ledger accounting invariants reject reset-like or internally inconsistent files', async (t) => {
  const variants = [
    { ...zeroLedger(), generation: { calls: 0, spendNanoUsd: 1 }, totalSpendNanoUsd: 0 },
    { ...zeroLedger(), reservedNanoUsd: 1 },
    {
      ...zeroLedger(),
      reservedNanoUsd: 1,
      pendingReservations: [{
        id: 'pending', callId: 'generation:pending', runId: 'pending', type: 'generation', status: 'reserved',
        liabilityNanoUsd: 1, ownerPid: 1, ownerToken: 'owner', configurationId: configuration.id,
        requestHash: 'd'.repeat(64),
        maxInputTokens: 1, maxOutputTokens: 1, createdAt: '2026-08-13T00:00:00.000Z',
      }],
      updatedAt: null,
    },
  ];

  for (const [index, ledger] of variants.entries()) {
    const context = await fixture(t, ledger);
    await assert.rejects(
      readSpendLedger({ ...context, budgetUsd: 10 }),
      new RegExp(index === 0 ? 'component' : index === 1 ? 'pending' : 'updatedAt', 'i'),
    );
  }
});

safetyTest('unbounded output and oversized input are rejected before dispatch', async (t) => {
  const context = await fixture(t);
  let calls = 0;
  await assert.rejects(
    runBudgetedCall(callOptions(context, {
      request: { model: configuration.model, contents: 'x', config: {} },
      call: async () => { calls += 1; },
    })),
    /maxOutputTokens/i,
  );
  await assert.rejects(
    runBudgetedCall(callOptions(context, {
      request: boundedRequest('x'.repeat((limits.maxInputTokens * 4) + 1)),
      call: async () => { calls += 1; },
    })),
    /input token upper bound/i,
  );
  assert.equal(calls, 0);
  assert.deepEqual(await readSpendLedger({ ...context, budgetUsd: 10 }), zeroLedger());
});

safetyTest('missing usage remains an unresolved reserved liability after dispatch', async (t) => {
  const upperBoundNanoUsd = calculateCallUpperBoundNanoUsd(configuration, limits);
  const variants = [
    null,
    { promptTokenCount: 10, candidatesTokenCount: 5 },
  ];

  for (const [index, usageMetadata] of variants.entries()) {
    const context = await fixture(t);
    await assert.rejects(
      runBudgetedCall(callOptions(context, {
        runId: `missing-usage-${index}`,
        call: async () => ({ usageMetadata }),
      })),
      /unresolved.*missing usage/i,
    );

    const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
    assert.equal(ledger.totalSpendNanoUsd, 0);
    assert.equal(ledger.reservedNanoUsd, upperBoundNanoUsd);
    assert.equal(ledger.pendingReservations[0].status, 'unresolved');
    assert.equal(ledger.pendingReservations[0].reason, 'missing_usage');
  }
});

safetyTest('provider rejection after dispatch remains an unresolved reserved liability', async (t) => {
  const context = await fixture(t);
  await assert.rejects(
    runBudgetedCall(callOptions(context, { call: async () => { throw new Error('provider rejected'); } })),
    /provider rejected/,
  );

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(ledger.pendingReservations[0].status, 'unresolved');
  assert.equal(ledger.pendingReservations[0].reason, 'provider_rejection');
  assert.equal(ledger.reservedNanoUsd, ledger.pendingReservations[0].liabilityNanoUsd);
});

safetyTest('post-dispatch pricing or usage parser failure remains unresolved', async (t) => {
  const context = await fixture(t);
  await assert.rejects(
    runBudgetedCall(callOptions(context, {
      actualUsd: () => { throw new Error('pricing parser failed'); },
    })),
    /pricing parser failed/,
  );

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(ledger.pendingReservations[0].status, 'unresolved');
  assert.equal(ledger.pendingReservations[0].reason, 'usage_pricing_or_checkpoint_failure');
});

safetyTest('reconciliation releases only proven-undispatched dead reservations and preserves dispatched liabilities', async (t) => {
  const liabilityNanoUsd = calculateCallUpperBoundNanoUsd(configuration, limits);
  const reservations = [
    {
      id: 'reserved-dead', callId: 'generation:run-reserved', runId: 'run-reserved', type: 'generation', status: 'reserved',
      liabilityNanoUsd, ownerPid: 999_999_991, ownerToken: 'dead-a', createdAt: '2000-01-01T00:00:00.000Z',
      requestHash: 'b'.repeat(64),
      configurationId: configuration.id, maxInputTokens: limits.maxInputTokens, maxOutputTokens: limits.maxOutputTokens,
    },
    {
      id: 'dispatched-dead', callId: 'generation:run-dispatched', runId: 'run-dispatched', type: 'generation', status: 'dispatched',
      liabilityNanoUsd, ownerPid: 999_999_992, ownerToken: 'dead-b', createdAt: '2000-01-01T00:00:00.000Z',
      requestHash: 'c'.repeat(64),
      dispatchedAt: '2000-01-01T00:00:01.000Z', configurationId: configuration.id,
      maxInputTokens: limits.maxInputTokens, maxOutputTokens: limits.maxOutputTokens,
    },
  ];
  const ledger = {
    ...zeroLedger(),
    reservedNanoUsd: liabilityNanoUsd * 2,
    pendingReservations: reservations,
    updatedAt: '2000-01-01T00:00:01.000Z',
  };
  const context = await fixture(t, ledger);

  await reconcileSpendLedger({ ...context, budgetUsd: 10, isProcessAlive: () => false });

  const reconciled = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(reconciled.pendingReservations.length, 1);
  assert.equal(reconciled.pendingReservations[0].id, 'dispatched-dead');
  assert.equal(reconciled.pendingReservations[0].status, 'unresolved');
  assert.equal(reconciled.pendingReservations[0].reason, 'owner_exited_after_dispatch');
  assert.equal(reconciled.reservedNanoUsd, liabilityNanoUsd);
});

safetyTest('near-cap upper-bound reservation and concurrent callers never exceed ten dollars', async (t) => {
  const upperBoundNanoUsd = calculateCallUpperBoundNanoUsd(configuration, limits);
  const startingSpendNanoUsd = 10_000_000_000 - upperBoundNanoUsd;
  const context = await fixture(t, {
    ...zeroLedger(),
    generation: { calls: 1, spendNanoUsd: startingSpendNanoUsd },
    totalSpendNanoUsd: startingSpendNanoUsd,
    completedCalls: {
      'generation:historical': completedCall({ runId: 'historical', spendNanoUsd: startingSpendNanoUsd }),
    },
    updatedAt: '2026-08-13T00:00:00.000Z',
  });
  let releaseFirst;
  const firstDispatched = new Promise((resolve) => { releaseFirst = resolve; });
  let signalFirstStarted;
  const firstStarted = new Promise((resolve) => { signalFirstStarted = resolve; });
  t.after(() => releaseFirst());
  let callCount = 0;
  const first = runBudgetedCall(callOptions(context, {
    runId: 'first',
    call: async () => {
      callCount += 1;
      signalFirstStarted();
      await firstDispatched;
      return { usageMetadata: validUsage({
        promptTokenCount: limits.maxInputTokens,
        candidatesTokenCount: limits.maxOutputTokens,
        thoughtsTokenCount: 0,
        totalTokenCount: limits.maxInputTokens + limits.maxOutputTokens,
      }) };
    },
  }));

  let dispatchTimeout;
  try {
    await Promise.race([
      firstStarted,
      first.then(
        () => Promise.reject(new Error('First near-cap call completed before the concurrency assertion.')),
        (error) => Promise.reject(new Error(`First near-cap call failed before dispatch: ${error.message}`, { cause: error })),
      ),
      new Promise((_resolve, reject) => {
        dispatchTimeout = setTimeout(
          () => reject(new Error('First near-cap call did not dispatch within 1 second.')),
          1_000,
        );
      }),
    ]);
  } finally {
    clearTimeout(dispatchTimeout);
  }
  const during = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(during.totalSpendNanoUsd + during.reservedNanoUsd, 10_000_000_000);
  const second = runBudgetedCall(callOptions(context, { runId: 'second' }));
  await assert.rejects(second, /budget stop before generation call/i);
  assert.equal(callCount, 1);
  releaseFirst();
  await first;

  const finalLedger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.ok(finalLedger.totalSpendNanoUsd + finalLedger.reservedNanoUsd <= 10_000_000_000);
  assert.equal(finalLedger.pendingReservations.length, 0);
});
