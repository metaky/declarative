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

import * as migrationUtils from '../scripts/gemini-migration-eval-utils.mjs';

const {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  readSpendLedger,
  runBudgetedCall,
  selectConfigurations,
} = migrationUtils;

const configuration = selectConfigurations('gemini-2.5-flash-baseline')[0];
const tokenLimits = { maxInputTokens: 64, maxOutputTokens: 2 };

function committedSchema4ZeroLedger() {
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

async function fixture(t, ledger = committedSchema4ZeroLedger()) {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-fail-closed-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  return { repoRoot, ledgerPath };
}

function callOptions(context, overrides = {}) {
  return {
    ...context,
    budgetUsd: 10,
    type: 'generation',
    runId: 'stable-call',
    configuration,
    tokenLimits,
    request: {
      model: configuration.model,
      contents: 'local-only request',
      config: { thinkingConfig: { thinkingBudget: 0 }, maxOutputTokens: tokenLimits.maxOutputTokens },
    },
    requestContext: {
      harnessVersion: 'task-6-fail-closed-v1',
      schemaVersion: 'local-only-v1',
      corpusSourceIdentity: 'fail-closed-fixture',
      repeat: 1,
      direction: null,
      moreIdeasRound: null,
      operation: 'translation',
    },
    call: async () => ({
      text: 'local-only result',
      usageMetadata: {
        promptTokenCount: 1,
        candidatesTokenCount: 0,
        thoughtsTokenCount: 0,
        totalTokenCount: 1,
      },
      candidates: [{ finishReason: 'STOP' }],
    }),
    ...overrides,
  };
}

test('only the exact committed schema-4 zero ledger migrates to a recovery-free schema', async (t) => {
  const context = await fixture(t);

  const migrated = await readSpendLedger({ ...context, budgetUsd: 10 });

  assert.equal(migrated.schemaVersion, 5);
  assert.equal(Object.hasOwn(migrated, 'recoveryActions'), false);
  assert.equal(JSON.parse(await readFile(context.ledgerPath, 'utf8')).schemaVersion, 5);
});

test('the harness exposes no recovery API and a fabricated recovery field is rejected', async (t) => {
  assert.equal('recoverAmbiguousCall' in migrationUtils, false);

  const context = await fixture(t, {
    ...committedSchema4ZeroLedger(),
    schemaVersion: 5,
  });
  await assert.rejects(
    readSpendLedger({ ...context, budgetUsd: 10 }),
    /recovery|unexpected|schema/i,
  );
});

test('schema validation rejects a fabricated retry authorization field', async (t) => {
  const schema5 = { ...committedSchema4ZeroLedger(), schemaVersion: 5 };
  delete schema5.recoveryActions;
  schema5.retryAuthorizations = [{ callId: 'generation:stable-call' }];
  const context = await fixture(t, schema5);

  await assert.rejects(
    readSpendLedger({ ...context, budgetUsd: 10 }),
    /unexpected|authorization|schema/i,
  );
});

test('schema validation rejects a zero ledger with a missing required field', async (t) => {
  const schema5 = { ...committedSchema4ZeroLedger(), schemaVersion: 5 };
  delete schema5.recoveryActions;
  delete schema5.updatedAt;
  const context = await fixture(t, schema5);

  await assert.rejects(
    readSpendLedger({ ...context, budgetUsd: 10 }),
    /missing|schema/i,
  );
});

test('retry-shaped run IDs are permanently rejected before a callback', async (t) => {
  const context = await fixture(t);
  let callbackCount = 0;

  await assert.rejects(
    runBudgetedCall(callOptions(context, {
      runId: 'stable-call:retry-1',
      call: async () => { callbackCount += 1; },
    })),
    /retry.*disabled|no.*retry/i,
  );

  assert.equal(callbackCount, 0);
});

test('an ancient lock owned by a reused live PID is recovered using process identity', async (t) => {
  const context = await fixture(t);
  const reusedPid = 424_242;
  await writeFile(`${context.ledgerPath}.lock`, `${JSON.stringify({
    ownerPid: reusedPid,
    ownerToken: 'old-owner',
    ownerIdentity: 'old-process-start',
    createdAt: '2000-01-01T00:00:00.000Z',
  })}\n`, { flag: 'wx' });

  await runBudgetedCall(callOptions(context, {
    lockOptions: {
      attempts: 5,
      retryMs: 1,
      staleMs: 1,
      processIdentity: (pid) => (pid === reusedPid ? 'new-process-start' : 'current-process-start'),
    },
  }));

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(ledger.generation.calls, 1);
});

test('an ancient lock with the same live process identity is never stolen', async (t) => {
  const context = await fixture(t);
  const livePid = 515_151;
  await writeFile(`${context.ledgerPath}.lock`, `${JSON.stringify({
    ownerPid: livePid,
    ownerToken: 'live-owner',
    ownerIdentity: 'same-process-start',
    createdAt: '2000-01-01T00:00:00.000Z',
  })}\n`, { flag: 'wx' });

  await assert.rejects(
    runBudgetedCall(callOptions(context, {
      lockOptions: {
        attempts: 2,
        retryMs: 1,
        staleMs: 1,
        processIdentity: () => 'same-process-start',
      },
    })),
    /lock/i,
  );
});

test('an ancient lock whose owner process no longer exists is recovered', async (t) => {
  const context = await fixture(t);
  const deadPid = 616_161;
  await writeFile(`${context.ledgerPath}.lock`, `${JSON.stringify({
    ownerPid: deadPid,
    ownerToken: 'dead-owner',
    ownerIdentity: 'dead-process-start',
    createdAt: '2000-01-01T00:00:00.000Z',
  })}\n`, { flag: 'wx' });

  await runBudgetedCall(callOptions(context, {
    lockOptions: {
      attempts: 5,
      retryMs: 1,
      staleMs: 1,
      processIdentity: (pid) => (pid === deadPid ? null : 'current-process-start'),
    },
  }));

  const ledger = await readSpendLedger({ ...context, budgetUsd: 10 });
  assert.equal(ledger.generation.calls, 1);
});
