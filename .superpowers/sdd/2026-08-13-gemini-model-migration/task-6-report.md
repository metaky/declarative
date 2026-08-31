# Task 6 Report: Reproducible Gemini Migration Evaluation Harness

## Status and boundary

Implementation is complete after four independent-review correction rounds and a final architecture simplification. Task 6 builds and verifies the harness locally only; Phase 3 has not been run.

- No Gemini generation, evaluator, network, paid, cloud, deployment, production-traffic, or credential-backed call occurred.
- Keyless checks explicitly removed `GEMINI_API_KEY`, `GOOGLE_API_KEY`, and `GOOGLE_APPLICATION_CREDENTIALS` from subprocess environments.
- Test callbacks used only local synthetic fixtures.
- No real prompt, model output, evaluator result, or paid-run artifact was created or committed.
- Product SDK behavior, production prompts, response contracts, UI, deployment, and live traffic were not changed.
- The canonical `evals/results/gemini-migration/phase-3-spend.json` is deterministic schema-5 zero state: zero calls, zero settled nano-USD, zero liability, an empty completed-call journal, and `updatedAt: null`.

## Harness delivered

- Imports and deduplicates every named historical corpus by stable ID while retaining provenance and preserving historical artifacts.
- Selects exactly the four approved configurations. `localOnly` cases never enter generation or evaluator call plans.
- Uses one canonical cumulative Phase 3 ledger across smoke, full, and restarted runs. Alternate ledger paths, symlink aliases, reset routes, and unbounded calls fail closed.
- Uses conservative integer nano-USD accounting and reserves a fully priced input/output upper bound before every local callback boundary. Settled spend plus unresolved liability cannot exceed $10.
- Retains the full upper-bound liability after dispatch whenever provider billing is unknown, including provider rejection, missing usage, pricing/parser/checkpoint failure, settlement interruption, and process interruption. Only a proven-undispatched reservation owned by a dead process may be released.
- Binds each logical call to an exact canonical request hash covering call type, stable ID, configuration, effective request, schema, corpus/source identity, repeat, direction, More Ideas round, operation, and evaluator version where applicable.
- Replays a completed call only when the stable ID, configuration, request hash, durable checkpoint hash, and checkpoint identity all match. Changed requests and damaged checkpoints fail closed before callback dispatch.
- Checkpoints generation results and evaluator rows atomically and restores original provider latency on replay.
- Reports visible candidate tokens, thought tokens, billed output, generation/evaluation settled spend, unresolved liability, total committed budget, remaining capacity, and pending counts.
- Every migration CLI `--help` path returns before ledger mutation, environment-file/API-key loading, client construction, or callback dispatch.

## Architecture reassessment: recovery removed

The operator recovery/retry feature added in correction round 3 was removed completely. Review showed that a recovery journal, retry authorizations, and recovery CLI created more integrity paths than the small evaluation budget justified.

The final policy is deliberately simpler:

- There is no recovery API, CLI, package command, journal, authorization, or replacement recovery command.
- Retry-shaped IDs are rejected before any callback.
- A dispatched or unresolved logical call permanently retains its upper-bound liability and cannot be retried automatically.
- A completed call with a damaged or mismatched checkpoint cannot be replayed or automatically regenerated.
- The operator must stop and inspect the ledger/checkpoints. There is no automated release, reset, settlement, or retry route.

This may sacrifice a small amount of the $10 test budget after an interruption. That tradeoff is intentional: it prevents an ambiguous call from being paid twice and keeps the audit model understandable.

The ledger moved to schema 5, which has no recovery fields. Automatic migration accepts only the byte-structure-equivalent committed schema-4 zero state at the fixed $10 budget. Active schema-4 ledgers, missing fields, unexpected fields, fabricated recovery entries, and fabricated retry authorizations are rejected.

## Lock and privacy safeguards

- The custom lock and stale-lock recovery implementation was removed after review demonstrated an ownership race. Ledger access now uses exactly pinned `proper-lockfile@4.1.2`, whose atomic-directory acquisition, heartbeat, stale timeout, bounded retries, and compromise detection are configured once for every ledger operation.
- The harness never manually removes, renames, or repairs the library lock. A compromised lock or release failure fails closed. Real child-process tests prove exclusive critical-section entry, preserved concurrent accounting, bounded recovery after a killed owner, and protection of a live owner beyond the stale threshold.
- Generated migration report directories are hardened to `0700` when private artifacts are created.
- Every migration writer—including the four auxiliary checks and the bakeoff rebuild-latest route—uses the same private atomic writer. Timestamped JSON/Markdown reports, latest pointers, call checkpoints, score checkpoints, and atomic temporary files are created as `0600` and renamed atomically.
- The canonical metadata-only ledger remains tracked and stageable with ordinary metadata permissions. All generated migration artifacts remain recursively ignored; the ledger is the sole exception.

## TDD evidence

Observed RED failures before implementation included:

1. The committed schema-4 zero ledger remained schema 4 instead of migrating to recovery-free schema 5.
2. `recoverAmbiguousCall` was still exported, the recovery package command still existed, and retry-shaped IDs still instructed operators to use recovery.
3. A lock with the same injected live process identity was stolen because lock ownership used PID liveness alone; process identity was not evaluated.
4. The report writer was absent, and the migration result root remained `0755` after private checkpoint creation.
5. A fabricated retry-authorization field and a schema missing `updatedAt` were accepted.

Each failure was observed before the corresponding production change, then rerun green. Earlier correction rounds also proved integer precision, conservative unknown-billing liability, hard-cap enforcement, canonical-ledger enforcement, exact request binding, durable completed-call replay, evaluator checkpoint integrity, original latency, and Git privacy.

## Verification evidence

- Final focused multi-process lock and private-writer suite: 18/18 passed with bounded timeouts.
- Final full repository suite: 162/162 passed.
- Critical durability/fail-closed/evaluator subset: 24/24 passed in each of five consecutive runs (120/120 total), with no hang.
- `npm run lint`: passed.
- `npm run build`: passed; only existing Browserslist-age and bundle-size advisories were emitted.
- `npm audit --omit=dev` reports the same 18 advisories as the clean pre-Task-6 baseline (1 low, 13 moderate, 3 high, 1 critical). The pinned lock package adds no new reported advisory. Audit remediation is tracked as separate dependency maintenance rather than being silently folded into this migration.
- Five migration `--help` paths passed keylessly; the canonical ledger SHA-256 remained unchanged at `bf972835e0282d217a9d4b569cd93e91db092fbcf1f9590e2e269bd4db3846fc`.
- Generated latest, timestamped, call-checkpoint, and score-checkpoint paths passed `git check-ignore --no-index`; the canonical ledger remained unignored/stageable.
- Permission tests passed for migration directories (`0700`) and all generated report/checkpoint files (`0600`).
- `git diff --check` is included in final pre-commit verification.

## Remaining boundary

No live model or evaluator behavior was validated because external and paid calls were prohibited. A future paid smoke run requires separate authorization and must use the same canonical cumulative ledger. If any call becomes ambiguous, the run must stop for inspection; the harness intentionally provides no recovery route.
