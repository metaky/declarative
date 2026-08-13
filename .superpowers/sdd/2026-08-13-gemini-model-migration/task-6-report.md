# Task 6 Report: Reproducible Gemini Migration Evaluation Harness

## Status and boundary

Complete after independent-review correction rounds 1–3. Task 6 builds and locally verifies the migration harness only; Phase 3 was not run.

- No Gemini generation callback, evaluator callback, network request, paid call, cloud call, deployment, traffic change, or credential-backed operation occurred.
- No API key or cloud credential was loaded or used. Keyless verification removed `GEMINI_API_KEY`, `GOOGLE_API_KEY`, and `GOOGLE_APPLICATION_CREDENTIALS` from the subprocess environment.
- Every provider/evaluator callback in tests was a local simulation using hand-derived synthetic fixtures.
- No real prompt, output, evaluator result, private payload, or paid-run content was created or committed.
- Product SDK behavior, production prompts, response schemas, UI, deployment, and traffic were not changed.
- The canonical `evals/results/gemini-migration/phase-3-spend.json` remains deterministic schema-4 zero state: zero calls, zero settled nano-USD, zero pending liability, empty completed/recovery journals, and `updatedAt: null`.

## Harness delivered

- Imports the named historical corpora by stable ID, deduplicates with provenance, and preserves historical artifacts and unrelated evaluation workflows.
- Exposes exactly four explicit allow-listed configurations. `localOnly` cases never enter generation or evaluation.
- Uses one canonical cumulative Phase 3 ledger across smoke, full, and restarted runs; alternate paths and symlink aliases fail closed.
- Requires explicit input/output token caps and atomically reserves a priced upper bound before every generation/evaluator callback. Settled spend plus pending liability cannot exceed $10.
- Uses integer nano-USD accounting. Positive charges consume budget, totals derive from integer component journals, and the only automatic migration accepts the exact prior committed zero-state schema.
- Conservatively retains post-dispatch liability for unknown usage, provider rejection, pricing/parser/checkpoint failure, settlement failure, and process interruption. Only proven pre-dispatch dead reservations may be released.
- Stores owner PID/token/timestamp lock metadata, recovers stale dead-process locks safely, and leaves potentially billed calls unresolved.
- Checkpoints generation results and each evaluator row atomically so settled stable calls resume without another callback.
- Reports visible candidate tokens, thought tokens, billed output, generation/evaluation settled spend and liability, total committed budget, remaining capacity, and pending counts.
- Every migration CLI `--help` path returns before paid-run option parsing, ledger access, environment-file/API-key loading, client construction, or callback dispatch.

## Correction round 3

### Exact request binding

Before reservation, the harness canonicalizes and SHA-256 hashes:

- call type and deterministic stable logical ID/attempt;
- exact registry configuration metadata, effective model, and full effective request/generation configuration;
- exact contents/prompt data and response schema in that request;
- harness, response-schema, and evaluator versions;
- corpus/source identity, case/provenance identity, repeat, direction, More Ideas round, operation, and other request-affecting context.

Only the request hash—not request content—is persisted in pending/completed journal entries. Reuse requires matching call ID, configuration ID, and request hash. Prompt, config, schema, corpus, repeat, direction, or round changes fail before callback dispatch. The effective request model must match the priced allow-listed configuration.

### Checkpoint integrity and original latency

- Direct result checkpoints bind stable call ID and request hash; the ledger stores only their canonical path and SHA-256 digest.
- Evaluator checkpoints bind the immutable source payload hash, every source-row hash, evaluator request hash, completed durable call ID/hash, scored-row hash, and a whole-checkpoint hash.
- Resume validates all bindings against the live canonical completed-call journal before trusting or skipping a row. Verdict, score, source-row, journal, or checkpoint tampering fails closed and does not trigger an automatic callback.
- Actual provider duration is persisted as safe completed-call metadata, restored on replay, and used in aggregate latency metrics. Cache-read duration is never substituted.

### Audited recovery workflow

The metadata-only recovery CLI never loads credentials or dispatches a provider/evaluator call:

```text
npm run quality:migration-recover -- --help
npm run quality:migration-recover -- --dry-validate
npm run quality:migration-recover -- --call-id=<type:stable-id> --reason-code=<code> --operator-id=<safe-id> --dry-run
npm run quality:migration-recover -- --call-id=<type:stable-id> --reason-code=<code> --operator-id=<safe-id> --confirm
```

`--dry-run` validates and previews without mutation. `--confirm` retains or settles the original upper-bound liability, records reason/timestamp/operator-safe metadata, marks the old result unavailable, and authorizes one new deterministic `:retry-N` attempt. The retry is not dispatched by recovery: it requires a separate full request-bound reservation and counts independently against the remaining cap. No automatic retry, release, reset, or same-attempt reuse route exists.

### Git privacy

All generated files beneath `evals/results/gemini-migration/` are ignored recursively, including nested timestamped/latest reports and private call/evaluator checkpoints. The canonical `phase-3-spend.json` is the sole exception. Existing historical artifacts outside this migration-only directory were not modified.

## TDD RED evidence

Observed failures before the round-3 implementation included:

1. Request-identity tests could not import `getProviderDurationMs`; after the first implementation, changed model and missing source context still produced `Missing expected rejection`.
2. Pending-call collision coverage initially lacked a persisted request hash and mismatch guard.
3. Evaluator integrity tests failed until scorer outcomes carried the durable completed-call binding; verdict, score, source-row, journal, and checkpoint-hash mutations then exercised fail-closed validation.
4. Recovery tests initially failed because no recovery function/CLI existed; the first Git privacy check showed generated latest/timestamped artifacts were not ignored.
5. A present-but-`undefined` required request field and a completed spend greater than its liability each produced `Missing expected rejection`; both now fail ledger/request validation.
6. The final process-level keyless-help regression passed 2/3 and failed because `check-gemini-models.mjs --help` parsed required paid-run configuration first. Equivalent early guards were then added to all four legacy migration scripts.

Earlier correction-round RED evidence covered sub-micro-dollar rounding to zero, repeated tiny-charge cap behavior, post-dispatch liability release, unbounded reservations, canonical-ledger bypasses, permanent stale locks, post-settlement callback replay, evaluator loop-only checkpointing, and private checkpoint permissions.

## GREEN evidence

- Bounded focused suite: 54/54 passed with a 5-second per-test timeout.
- Durability/request-identity/recovery/evaluator subset: 24/24 passed in each of five consecutive runs (120/120 total), without a hang.
- Full repository suite: 149/149 passed.
- `npm run lint`: passed.
- `npm run build`: passed; only existing Browserslist-age and bundle-size advisories were emitted.
- Six migration/recovery `--help` commands plus recovery `--dry-validate` passed keylessly; canonical ledger SHA-256 remained `8c361f606a6cce584e419133357574a3032f290486c8a44bae7b71bef0a27b29` before and after.
- Six representative root, nested, latest, timestamped, call-checkpoint, and score-checkpoint paths passed `git check-ignore --no-index`; the canonical ledger remained unignored/stageable.
- `git diff --check`: passed before report update and is rerun in final staged verification.

Adversarial local-only coverage includes exact request replay and changed prompt/config/schema/corpus/repeat/direction/round collisions; all provider crash boundaries; completed-journal and evaluator-checkpoint tampering; original-latency replay; ambiguous and damaged-checkpoint recovery; distinct retry identity; combined old/retry cap accounting; sub-micro and repeated tiny charges; near-cap concurrency; missing usage; provider rejection; pricing and settlement failure; canonical/symlink enforcement; no reset route; and stale-lock reconciliation.

## Changed scope and concerns

Changed scope is limited to the canonical zero ledger, migration-only ignore rule, migration evaluation utilities/reporting, five existing migration call scripts, one recovery CLI/package command, local tests, and this report. Existing historical result artifacts were preserved.

No live model/evaluator behavior was validated because external and paid calls were prohibited. A future paid smoke run requires separate authorization and must use the same canonical cumulative ledger. Existing build advisories are unrelated to Task 6.
