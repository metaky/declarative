import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
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
  LEDGER_LOCK_OPTIONS,
  MIGRATION_TOKEN_LIMITS,
  calculateCallUpperBoundNanoUsd,
  selectConfigurations,
} from '../scripts/gemini-migration-eval-utils.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workerPath = path.join(repoRoot, 'scripts', 'test-fixtures', 'gemini-migration-lock-worker.mjs');
const timeoutMs = 15_000;

function zeroLedger(overrides = {}) {
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
    ...overrides,
  };
}

function historicalCompletedCall(configuration, spendNanoUsd) {
  return {
    callId: 'generation:historical',
    runId: 'historical',
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
  const root = await mkdtemp(path.join(os.tmpdir(), 'declarative-lock-integration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ledgerPath = path.join(root, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  const statePath = path.join(root, 'state.json');
  await mkdir(path.dirname(ledgerPath), { recursive: true });
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
  await writeFile(statePath, `${JSON.stringify({ active: 0, maxActive: 0, completed: 0, entries: [] })}\n`);
  return { root, ledgerPath, statePath };
}

function startWorker(options) {
  const child = spawn(process.execPath, [workerPath, JSON.stringify(options)], {
    cwd: repoRoot,
    env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '', GOOGLE_APPLICATION_CREDENTIALS: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const completed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Worker timed out. stdout=${stdout} stderr=${stderr}`));
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
  return { child, completed, output: () => ({ stdout, stderr }) };
}

async function waitForOutput(worker, pattern, waitMs = 3_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    if (pattern.test(worker.output().stdout)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Expected worker output ${pattern}. Got ${JSON.stringify(worker.output())}`);
}

test('one shared proper-lockfile option set is conservative and bounded', () => {
  assert.ok(LEDGER_LOCK_OPTIONS.stale >= 5_000);
  assert.ok(LEDGER_LOCK_OPTIONS.update <= LEDGER_LOCK_OPTIONS.stale / 2);
  assert.ok(Number.isInteger(LEDGER_LOCK_OPTIONS.retries.retries));
  assert.ok(LEDGER_LOCK_OPTIONS.retries.retries > 0);
  assert.equal(LEDGER_LOCK_OPTIONS.realpath, true);
});

test('real processes execute only one ledger critical section at a time', { timeout: timeoutMs }, async (t) => {
  const context = await fixture(t);
  const workers = Array.from({ length: 4 }, (_, index) => startWorker({
    mode: 'critical',
    workerId: `worker-${index}`,
    ledgerPath: context.ledgerPath,
    statePath: context.statePath,
    holdMs: 100,
  }));
  const outcomes = await Promise.all(workers.map((worker) => worker.completed));
  assert.deepEqual(outcomes.map(({ code }) => code), [0, 0, 0, 0]);
  const state = JSON.parse(await readFile(context.statePath, 'utf8'));
  assert.equal(state.maxActive, 1);
  assert.equal(state.active, 0);
  assert.equal(state.completed, 4);
  assert.equal(new Set(state.entries).size, 4);
});

test('concurrent real-process reservations cannot exceed the cap or lose updates', { timeout: timeoutMs }, async (t) => {
  const configuration = selectConfigurations('gemini-3.6-flash-medium')[0];
  const liability = calculateCallUpperBoundNanoUsd(configuration, MIGRATION_TOKEN_LIMITS.generation);
  const startingSpend = 10_000_000_000 - liability;
  const context = await fixture(t, zeroLedger({
    generation: { calls: 1, spendNanoUsd: startingSpend },
    totalSpendNanoUsd: startingSpend,
    completedCalls: {
      'generation:historical': historicalCompletedCall(configuration, startingSpend),
    },
    updatedAt: '2026-08-13T00:00:00.000Z',
  }));
  const workers = Array.from({ length: 4 }, (_, index) => startWorker({
    mode: 'budgeted',
    workerId: `budget-${index}`,
    repoRoot: context.root,
    ledgerPath: context.ledgerPath,
  }));
  const outcomes = await Promise.all(workers.map((worker) => worker.completed));
  assert.ok(outcomes.every(({ code }) => code === 0));
  assert.equal(outcomes.filter(({ stdout }) => /SUCCESS/.test(stdout)).length, 1);
  assert.equal(outcomes.filter(({ stdout }) => /BUDGET_STOP/.test(stdout)).length, 3);
  const ledger = JSON.parse(await readFile(context.ledgerPath, 'utf8'));
  assert.equal(ledger.generation.calls, 2);
  assert.equal(ledger.pendingReservations.length, 0);
  assert.equal(ledger.reservedNanoUsd, 0);
  assert.equal(ledger.totalSpendNanoUsd, 10_000_000_000);
});

test('a SIGKILL owner becomes stale and a successor acquires within the bounded retry window', { timeout: timeoutMs }, async (t) => {
  const context = await fixture(t);
  const owner = startWorker({ mode: 'crash', ledgerPath: context.ledgerPath });
  await waitForOutput(owner, /ENTERED/);
  owner.child.kill('SIGKILL');
  const ownerOutcome = await owner.completed;
  assert.equal(ownerOutcome.signal, 'SIGKILL');

  const startedAt = Date.now();
  const successor = startWorker({
    mode: 'critical', workerId: 'successor', ledgerPath: context.ledgerPath, statePath: context.statePath,
  });
  const outcome = await successor.completed;
  const elapsedMs = Date.now() - startedAt;
  assert.equal(outcome.code, 0, outcome.stderr);
  assert.ok(elapsedMs >= 4_000, `stale lock was taken too early after ${elapsedMs} ms`);
  assert.ok(elapsedMs < timeoutMs, `stale recovery exceeded the bounded window: ${elapsedMs} ms`);
});

test('a live owner is refreshed and never stolen after the stale threshold', { timeout: timeoutMs }, async (t) => {
  const context = await fixture(t);
  const owner = startWorker({
    mode: 'critical', workerId: 'live-owner', ledgerPath: context.ledgerPath, statePath: context.statePath, holdMs: 6_500,
  });
  await waitForOutput(owner, /ENTERED/);
  const contender = startWorker({
    mode: 'critical', workerId: 'contender', ledgerPath: context.ledgerPath, statePath: context.statePath,
  });
  const [ownerOutcome, contenderOutcome] = await Promise.all([owner.completed, contender.completed]);
  assert.equal(ownerOutcome.code, 0, ownerOutcome.stderr);
  assert.equal(contenderOutcome.code, 0, contenderOutcome.stderr);
  const state = JSON.parse(await readFile(context.statePath, 'utf8'));
  assert.equal(state.maxActive, 1);
  assert.deepEqual(state.entries, ['live-owner', 'contender']);
});

test('lock compromise terminates the owner instead of continuing unlocked', { timeout: timeoutMs }, async (t) => {
  const context = await fixture(t);
  const worker = startWorker({ mode: 'compromise', ledgerPath: context.ledgerPath });
  await waitForOutput(worker, /ENTERED/);
  const libraryLockPath = `${context.ledgerPath}.lock`;
  await rm(libraryLockPath, { recursive: true, force: true });
  await mkdir(libraryLockPath);
  const outcome = await worker.completed;
  assert.notEqual(outcome.code, 0);
  assert.doesNotMatch(outcome.stdout, /COMPLETED/);
  assert.match(outcome.stderr, /compromis|lock/i);
});

test('release errors fail closed', { timeout: timeoutMs }, async (t) => {
  const context = await fixture(t);
  const gatePath = path.join(context.root, 'release-gate');
  const worker = startWorker({ mode: 'release', ledgerPath: context.ledgerPath, gatePath });
  await waitForOutput(worker, /ENTERED/);
  const libraryLockPath = `${context.ledgerPath}.lock`;
  await rm(libraryLockPath, { recursive: true, force: true });
  await mkdir(libraryLockPath);
  await writeFile(path.join(libraryLockPath, 'block-release'), 'occupied');
  await writeFile(gatePath, 'release');
  const outcome = await worker.completed;
  assert.notEqual(outcome.code, 0);
  assert.doesNotMatch(outcome.stdout, /COMPLETED/);
  assert.match(outcome.stderr, /release|lock/i);
});
