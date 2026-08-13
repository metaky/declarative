# Task 6 Report: Reproducible Gemini Migration Evaluation Harness

## Status

Complete after independent-review correction rounds 1 and 2. This task builds and locally verifies the migration evaluation harness only. Phase 3 was not run.

## External-call and spend statement

- No Gemini generation callback, automated-evaluator callback, network request, paid call, cloud call, deployment, traffic change, or credential-backed operation was made.
- No API key or cloud credential was loaded or used during implementation or verification.
- All provider/evaluator callbacks in tests were local simulations with hand-derived responses.
- No paid-run prompt, output, evaluator result, or other paid content was created or committed.
- The canonical `phase-3-spend.json` is a deterministic schema-3 zero state: zero generation/evaluation calls, zero nano-USD settled spend, zero pending liability, an empty completed-call journal, and a null update timestamp.
- Product SDK behavior, prompts, response schemas, application UI, deployment, and production traffic were not changed.

## Harness delivered

- Imports the four named historical corpora by stable ID, deduplicates while retaining provenance, preserves historical artifacts, and adds migration-only coverage without rewriting unrelated workflows.
- Exposes exactly four explicit allow-listed registry configurations.
- Keeps all `localOnly` cases outside generation and evaluation; local-only plans report zero model/evaluator calls.
- Uses one canonical cumulative ledger at `evals/results/gemini-migration/phase-3-spend.json` across smoke/full/restarts.
- Requires explicit bounded input and output token caps before every generation/evaluation callback and atomically reserves their priced upper bound before dispatch.
- Reports prompt tokens, visible candidate tokens, thought tokens, billed output tokens, generation spend, evaluator spend, and combined spend.
- Returns CLI help before API-key loading, client creation, ledger mutation, or paid-capable work.

## Correction round 1: cap and recovery safety

- Dispatch is durably recorded before the provider/evaluator callback can run.
- Provider rejection, missing usage, pricing/parser/checkpoint failure, settlement failure, and other post-dispatch exceptions preserve the full upper-bound liability as `dispatched` or `unresolved`; they do not release it.
- Every request must send `maxOutputTokens` equal to its explicit output cap. Serialized input bytes provide a conservative local input-token upper bound, and actual usage is rejected if it exceeds either cap.
- Atomic reservation under the ledger lock proves settled spend plus all pending liabilities never exceeds the hard $10 cap, including concurrent near-cap callers.
- Alternate ledger paths, canonical-ledger symlinks, and path-component symlink aliases are rejected. Accounting validates component sums, pending-liability sums, owner metadata, timestamps, and the aggregate cap.
- There is no exported initialize/reset function and no route that recreates a missing or active ledger.
- Lock files contain owner PID, token, and timestamp. Dead-owner stale locks can be safely quarantined; dead-owner reservations are released only while still provably pre-dispatch. Potentially spent reservations remain unresolved.
- Evaluator rows are atomically checkpointed by stable run ID after each completed score and are skipped on resume.

## Correction round 2: monetary precision and crash idempotency

### Integer accounting

- Persisted money uses safe integer nano-USD only (`1 USD = 1,000,000,000 nano-USD`). No ledger total or invariant is derived from rounded floating-point USD.
- Every configured per-token price resolves exactly to integer nano-USD. Usage charges are integer token counts multiplied by those rates.
- Any positive custom USD charge is rounded upward to at least one nano-USD. Human-readable USD is derived only for display.
- The only legacy migration accepts the exact committed schema-2 zero state at the unchanged $10 budget. Any active or altered legacy ledger is rejected; there is no reset path.
- Generation/evaluation component totals, total settled spend, pending liabilities, completed-call totals, and remaining capacity are validated and derived from integers.

### Durable stable-call journal

- Each generation/evaluation call uses deterministic ID `<type>:<stable-run-id>`.
- Reservation checks the completed-call journal before dispatch. A completed ID returns its durable result and cannot invoke the provider/evaluator callback again.
- Settlement atomically removes the pending liability, adds integer settled spend, and inserts safe completed-call metadata in the canonical ledger.
- The ledger journal stores only stable identity, configuration ID, integer charge, normalized token counts, timestamps, and a hashed checkpoint reference. It stores no prompt, output text, evaluation payload, or private content.
- Full resumable results are written atomically to canonical ignored checkpoint trees. Direct call checkpoints and evaluator partial checkpoints use private directories (`0700`) and files (`0600`).
- Faults after dispatch record, provider response, or result checkpoint preserve ambiguous liability and block re-dispatch pending explicit reconciliation.
- Faults immediately after settlement or after the evaluator row checkpoint resume from the completed journal/checkpoint without a second callback.
- Generation loops and evaluator loops therefore resume by stable ID without re-paying any call known to have settled.

### Reports

- Machine and Markdown reports distinguish settled generation/evaluation spend from reserved, dispatched, and unresolved generation/evaluation liability.
- Reports include total settled spend, total liability, total committed budget, remaining capacity, and pending counts overall and by call type/status.

## TDD evidence

Observed RED failures before the correction-round implementations included:

1. The round-1 adversarial suite failed because canonical-path enforcement, bounded reservations, conservative post-dispatch accounting, stale-lock recovery, and row checkpointing did not yet exist.
2. Missing thought usage on a thinking-enabled response produced `Missing expected rejection`, demonstrating that an unknown billed amount could settle as zero.
3. A stale malformed lock produced `Could not acquire Phase 3 spend ledger lock after 5 attempts`, reproducing the permanent-lock failure.
4. Round-2 durability tests initially failed at module load because `NANO_USD_PER_USD` and integer-ledger behavior did not exist.
5. Hand-derived near-cap and schema fixtures then exposed the explicit serialized-input bound and completed-journal invariants until the fixtures and implementation matched the bounded contract.
6. The report regression failed because the former floating ledger fields could not supply the required settled/liability/committed breakdown.
7. The final privacy regression failed `493 !== 448` (`0755` versus required `0700`) for an evaluator checkpoint directory before private directory/file modes were enforced.

GREEN evidence after the narrow implementations:

- Durability suite: 10/10 passing with a 5-second timeout per test.
- Durability stability: five consecutive runs, 50/50 tests total, without a hang.
- Combined focused suite: 41/41 passing.
- Full repository suite: 135/135 passing.
- Private-checkpoint regression: 13/13 combined model-bakeoff/durability tests passing after the observed permission failure.

Adversarial local-only coverage includes a sub-micro-dollar charge, repeated tiny charges, an exact near-cap fit plus over-cap rejection, concurrent reservation safety, missing usage, provider rejection, pricing/parser failure, settlement failure, alternate and symlinked ledgers, no reset/reinit route, stale-lock recovery, dead-owner reconciliation, and all four crash boundaries.

## Final verification

- `node --test --test-timeout=5000 test/gemini-migration-eval-utils.test.mjs test/gemini-migration-spend-safety.test.mjs test/gemini-migration-durability.test.mjs test/model-bakeoff.test.mjs test/quality-review-packet.test.mjs`: 41/41 passed.
- Five repeated bounded durability runs: 50/50 passed.
- `npm test`: 135/135 passed.
- `npm run lint`: passed.
- `npm run build`: passed; only the existing Browserslist-age and bundle-size warnings were emitted.
- Keyless `node scripts/run-model-bakeoff.mjs --help`: exited 0 and printed help before credentials or work.
- Canonical ledger SHA-256 was unchanged before/after help: `72d8068d06e2939f8954083257948c4e6f5bb906e267b257bd464d71f0068e57`.
- `git diff --check`: passed.
- Syntax checks passed for all changed migration scripts.
- All six generation/evaluator invocation sites are wrapped by `runBudgetedCall` and provide private-safe result serialization.

## Changed scope and concerns

- Changed scope is limited to the Phase 3 zero ledger, migration evaluation utilities/reporting, the five existing migration call scripts, private checkpoint ignore rules, and local tests. The exact committed paths are `.gitignore`, `evals/results/gemini-migration/phase-3-spend.json`, `scripts/{check-gemini-models,check-get-more-ideas-multiround,check-variation-prompts,gemini-migration-eval-utils,run-interest-generalization-check,run-model-bakeoff}.mjs`, `test/{gemini-migration-eval-utils,gemini-migration-spend-safety,gemini-migration-durability,model-bakeoff}.test.mjs`, and this report.
- Existing historical result artifacts were not modified. The implementation report is intentionally force-added from the ignored SDD directory.
- No live model, evaluator, SDK, credential, schema, or provider-behavior validation was performed because external and paid calls were prohibited. A separately authorized future smoke run remains the first live validation and must retain this canonical cumulative ledger.
- Existing Browserslist-age and large-bundle warnings are unrelated to Task 6.
