import { setTimeout as delay } from 'node:timers/promises';
import { readFile, writeFile } from 'node:fs/promises';

import {
  MIGRATION_TOKEN_LIMITS,
  runBudgetedCall,
  selectConfigurations,
  withLedgerLock,
} from '../gemini-migration-eval-utils.mjs';

const options = JSON.parse(process.argv[2]);

async function readState() {
  return JSON.parse(await readFile(options.statePath, 'utf8'));
}

async function writeState(state) {
  await writeFile(options.statePath, `${JSON.stringify(state)}\n`);
}

async function criticalSection() {
  await withLedgerLock(options.ledgerPath, async () => {
    const entered = await readState();
    entered.active += 1;
    entered.maxActive = Math.max(entered.maxActive, entered.active);
    entered.entries.push(options.workerId);
    await writeState(entered);
    process.stdout.write('ENTERED\n');
    await delay(options.holdMs ?? 0);
    const leaving = await readState();
    leaving.active -= 1;
    leaving.completed += 1;
    await writeState(leaving);
  });
}

async function crashWhileHolding() {
  await withLedgerLock(options.ledgerPath, async () => {
    process.stdout.write('ENTERED\n');
    await new Promise(() => setInterval(() => {}, 1_000));
  });
}

async function waitForGate() {
  while (true) {
    try {
      await readFile(options.gatePath);
      return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      await delay(20);
    }
  }
}

async function releaseAfterTamper() {
  await withLedgerLock(options.ledgerPath, async () => {
    process.stdout.write('ENTERED\n');
    await waitForGate();
  });
  process.stdout.write('COMPLETED\n');
}

async function waitForCompromise() {
  await withLedgerLock(options.ledgerPath, async () => {
    process.stdout.write('ENTERED\n');
    await delay(8_000);
  });
  process.stdout.write('COMPLETED\n');
}

async function budgetedCall() {
  const configuration = selectConfigurations('gemini-3.6-flash-medium')[0];
  try {
    await runBudgetedCall({
      repoRoot: options.repoRoot,
      ledgerPath: options.ledgerPath,
      budgetUsd: 10,
      type: 'generation',
      runId: options.workerId,
      configuration,
      tokenLimits: MIGRATION_TOKEN_LIMITS.generation,
      request: {
        model: configuration.model,
        contents: 'Local-only bounded lock fixture.',
        config: { maxOutputTokens: MIGRATION_TOKEN_LIMITS.generation.maxOutputTokens },
      },
      requestContext: {
        harnessVersion: 'lock-worker-v1',
        schemaVersion: 'local-only-v1',
        corpusSourceIdentity: 'multi-process-lock-fixture',
        repeat: 1,
        direction: null,
        moreIdeasRound: null,
        operation: 'generation',
      },
      call: async () => ({
        text: 'local-only result',
        usageMetadata: {
          promptTokenCount: MIGRATION_TOKEN_LIMITS.generation.maxInputTokens,
          candidatesTokenCount: MIGRATION_TOKEN_LIMITS.generation.maxOutputTokens,
          thoughtsTokenCount: 0,
        },
      }),
      serializeResult: (value) => value,
    });
    process.stdout.write('SUCCESS\n');
  } catch (error) {
    if (/budget stop/i.test(error.message)) {
      process.stdout.write('BUDGET_STOP\n');
      return;
    }
    throw error;
  }
}

const actions = {
  budgeted: budgetedCall,
  compromise: waitForCompromise,
  crash: crashWhileHolding,
  critical: criticalSection,
  release: releaseAfterTamper,
};

await actions[options.mode]();
