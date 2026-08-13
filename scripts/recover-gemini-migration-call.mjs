import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  readSpendLedger,
  recoverAmbiguousCall,
} from './gemini-migration-eval-utils.mjs';

const HELP = `Audited Gemini migration call recovery

Usage:
  node scripts/recover-gemini-migration-call.mjs --dry-validate
  node scripts/recover-gemini-migration-call.mjs --call-id=<type:stable-id> --reason-code=<code> --operator-id=<safe-id> --dry-run
  node scripts/recover-gemini-migration-call.mjs --call-id=<type:stable-id> --reason-code=<code> --operator-id=<safe-id> --confirm

Safety:
  --help          Print help before reading the ledger or loading credentials.
  --dry-validate  Validate the canonical ledger without mutation.
  --dry-run       Validate one recovery and show its deterministic retry ID without mutation.
  --confirm       Settle/retain the original maximum liability and write a metadata-only audit record.

Reason codes:
  provider-outcome-unknown
  checkpoint-damaged
  settlement-interrupted

This command never loads credentials, calls a provider/evaluator, releases spend, resets the ledger,
or dispatches the retry. Run the returned retry ID separately through the fully bounded harness.
`;

function option(argv, name) {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    process.stdout.write(HELP);
    return;
  }
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const ledgerPath = path.join(repoRoot, CANONICAL_SPEND_LEDGER_RELATIVE_PATH);
  if (argv.includes('--dry-validate')) {
    const ledger = await readSpendLedger({ repoRoot, ledgerPath, budgetUsd: 10 });
    const zero = ledger.totalSpendNanoUsd === 0
      && ledger.reservedNanoUsd === 0
      && Object.keys(ledger.completedCalls).length === 0;
    process.stdout.write(`Canonical Phase 3 ledger valid; zero state: ${zero}.\n`);
    return;
  }

  const dryRun = argv.includes('--dry-run');
  const confirmed = argv.includes('--confirm');
  if (dryRun === confirmed) {
    throw new Error('Choose exactly one of --dry-run or --confirm.');
  }
  const result = await recoverAmbiguousCall({
    repoRoot,
    ledgerPath,
    budgetUsd: 10,
    callId: option(argv, 'call-id'),
    reasonCode: option(argv, 'reason-code'),
    operatorId: option(argv, 'operator-id'),
    dryRun,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
