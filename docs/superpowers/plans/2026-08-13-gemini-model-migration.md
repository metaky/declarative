# Gemini Model Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Declarative from Gemini 2.5 Flash to the best passing Gemini 3.5 Flash-Lite or Gemini 3.6 Flash configuration before September 30, 2026, without reducing caregiver-facing quality, safety, reliability, or usability.

**Architecture:** Preserve the current stateless, one-request `generateContent` flow. First establish a secret-managed 2.5 Flash rollback revision, then introduce a shared allow-listed model registry, deterministic response validation, privacy-safe telemetry, and an explicit evaluation harness. Compare successors with unchanged prompts, obtain Kyle's blinded product decision, and release the selected configuration through a tagged no-traffic revision and measured Cloud Run canary.

**Tech Stack:** Node.js ESM, Express 5, React 19, TypeScript, Vite, `@google/genai` v2, Node's built-in test runner, Google Cloud Run, Google Secret Manager, Upstash Redis, and gcloud CLI.

## Global Constraints

- Follow the approved design in `docs/superpowers/specs/2026-08-13-gemini-model-migration-design.md`.
- Keep `gemini-2.5-flash` with `thinkingBudget: 0` in production until the Phase 4 product decision and the Phase 5 canary.
- Do not change the system instruction, translation prompt, variation prompt, response schema, visible interface, or caregiver-facing copy during candidate comparison.
- Never print, log, commit, copy into reports, or send to a subagent any Gemini or Upstash credential value.
- Use test-driven development for each production behavior change: add the failing test, run it and inspect the expected failure, implement the minimum change, then run the complete deterministic suite.
- After every task commit, dispatch a fresh independent reviewer with the task brief, implementer report, and complete task diff. A task is not integrated or marked complete until both spec compliance and task quality pass; material findings enter a tested fix-and-re-review loop.
- Live Gemini calls are deliberate paid evaluations, never part of the normal deterministic test command.
- Phase 3 paid Gemini spend is capped at $10. Stop for Kyle before exceeding it.
- Stop for Kyle before revoking an old credential, deleting a historical Cloud Run revision, approving a gate exception, choosing a production candidate, or using a supervised full-traffic window.
- A successful `git push` does not update production. Verify the exact Cloud Run revision, traffic split, logs, health endpoint, and `https://declarativeapp.org` after every deployment or traffic change.
- September 30, 2026 is the latest acceptable 100% migration date. Proceed immediately when each gate passes; do not wait for calendar milestones.

---

## Task 1: Establish the Project Control Plane and Reproducible Baseline

**Files:**

- Create: `docs/runbooks/gemini-migration-operations.md`
- Create: `docs/migrations/gemini/phase-1-baseline.md`
- Modify: `package.json`
- Test: `test/project-scripts.test.mjs`

- [ ] Record the starting Git commit, active branch, production service, project, region, current 100% revision, current model configuration, current custom-domain status, and the latest baseline quality metrics in `docs/migrations/gemini/phase-1-baseline.md`. Record secret names and reference status only; never record values.

- [ ] Add a failing deterministic test in `test/project-scripts.test.mjs` asserting that `package.json` exposes these commands:

  ```js
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts.check, 'npm run test && npm run lint && npm run build');
  ```

- [ ] Run `node --test test/project-scripts.test.mjs` and confirm the failure is only the missing scripts.

- [ ] Add `test` and `check` scripts to `package.json` without changing existing script behavior.

- [ ] Create `docs/runbooks/gemini-migration-operations.md` with exact commands for read-only state capture, tagged deployment, traffic inspection, log inspection, health verification, promotion, and rollback. Every command must use named variables such as `SERVICE`, `PROJECT`, `REGION`, `BASELINE_REVISION`, and `CANDIDATE_REVISION`; none may contain secret values.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  git diff --check
  ```

- [ ] Commit:

  ```bash
  git add package.json docs/runbooks/gemini-migration-operations.md docs/migrations/gemini/phase-1-baseline.md test/project-scripts.test.mjs
  git commit -m "chore: establish Gemini migration controls"
  ```

**Gate:** The project has one deterministic check command, a current baseline record, and a rollback-oriented operating runbook. No cloud state or production behavior has changed.

---

## Task 2: Move the Existing Production Credentials Behind Secret Manager

**Files:**

- Modify: `docs/migrations/gemini/phase-1-baseline.md`
- Modify: `docs/runbooks/gemini-migration-operations.md`

- [ ] Confirm the active gcloud account, project `gen-lang-client-0598048123`, service `declarative`, and region `us-west1` using read-only commands. Confirm Secret Manager API availability and IAM permission without displaying environment values.

- [ ] Create these Secret Manager containers if absent:

  ```text
  declarative-gemini-api-key
  declarative-upstash-redis-rest-url
  declarative-upstash-redis-rest-token
  ```

- [ ] Transfer each existing literal Cloud Run value directly into a new secret version through a restrictive temporary file or pipe. Disable shell tracing, make the temporary location owner-only, validate that each secret has an enabled version, and securely remove the temporary material. Do not echo values and do not place them in command arguments.

- [ ] Record each enabled secret's numeric version identifier in the private operational session and the non-sensitive migration evidence. Every Cloud Run environment-variable secret reference in this project must pin an explicit numeric version; never deploy an environment-variable secret reference to `latest`.

- [ ] Grant the Cloud Run runtime service account `roles/secretmanager.secretAccessor` on only those three secrets.

- [ ] Deploy the unchanged application source as a new tagged, zero-traffic Cloud Run revision named with suffix `secret-baseline`, retaining `gemini-2.5-flash` and `thinkingBudget: 0`, and map:

  ```text
  GEMINI_API_KEY=declarative-gemini-api-key:GEMINI_SECRET_VERSION
  UPSTASH_REDIS_REST_URL=declarative-upstash-redis-rest-url:UPSTASH_URL_SECRET_VERSION
  UPSTASH_REDIS_REST_TOKEN=declarative-upstash-redis-rest-token:UPSTASH_TOKEN_SECRET_VERSION
  ```

  Replace the three uppercase version labels at execution time with the validated numeric versions; they are explanatory labels, not literal deploy values.

- [ ] Verify the tagged revision without public traffic:

  - `GET /api/challenge` returns a one-time challenge.
  - Initial translation returns 3 or 4 non-empty suggestions.
  - More Ideas returns 3 or 4 suggestions distinct from supplied history.
  - Each variation direction returns exactly 2 suggestions after source deduplication.
  - Interest Based without an interest is rejected before a model call.
  - Rate limiting still returns a calm 429 response.
  - Logs identify `gemini-2.5-flash`, `thinkingBudget: 0`, and zero thought tokens without prompt or output text.

- [ ] Move 100% traffic to the secret-managed 2.5 revision, verify `https://declarativeapp.org`, then perform one controlled traffic rollback to the prior revision and one controlled return to the secret-managed revision. Record revision IDs, timestamps, checks, and results in the Phase 1 baseline document.

- [ ] Rotate the Gemini credential with overlap: create a new restricted Gemini API credential, add it as a new Secret Manager version, deploy/test a tagged 2.5 revision pinned to that exact numeric version, and promote only after the complete behavior check passes. Keep the old Gemini credential active and record its identifier and pending-revocation state without recording its value.

- [ ] Determine from Upstash's current controls whether a second REST token can coexist with the old token. If overlap is supported, create the replacement, add it as a new secret version, test a tagged 2.5 revision pinned to that exact numeric version, and promote it before touching the old token. If Upstash only offers regeneration that immediately invalidates the current token, stop and ask Kyle before that irreversible rotation; do not bundle it with Gemini rotation.

- [ ] Present Kyle with the verified replacement state and request approval immediately before revoking the old Gemini credential or any invalidated/replaced Upstash credential. If approval is deferred, leave the working old credential active and document that state; credential revocation is not required to continue model-quality work when the secret-managed rollback path is healthy.

- [ ] Inspect service metadata and the new revision to confirm credentials are secret references rather than literal values. Do not delete historical revisions. Revoke a credential only in the separately approved revocation step immediately above.

- [ ] Commit the documentation evidence:

  ```bash
  git add docs/migrations/gemini/phase-1-baseline.md docs/runbooks/gemini-migration-operations.md
  git commit -m "docs: record secret-managed Gemini baseline"
  ```

**Gate:** A verified secret-managed 2.5 Flash revision serves 100% of production traffic, the custom domain is healthy, rollback has been exercised, the Gemini replacement credential is verified, and every old credential has an explicit active/revoked/pending state. Upstash rotation may remain pending only when safe overlap is unavailable and Kyle has not approved the irreversible regeneration step.

---

## Task 3: Add the Shared Allow-Listed Model Registry

**Files:**

- Create: `services/geminiConfig.js`
- Create: `test/gemini-config.test.mjs`
- Modify: `server.js`
- Modify: `scripts/run-model-bakeoff.mjs`

- [ ] Add failing tests covering the exact configuration IDs and metadata:

  ```js
  const EXPECTED_IDS = [
    'gemini-2.5-flash-baseline',
    'gemini-3.5-flash-lite-minimal',
    'gemini-3.6-flash-minimal',
    'gemini-3.6-flash-medium',
  ];
  ```

  The tests must assert model ID, thinking mode, `thinkingBudget` or `thinkingLevel`, input price, output price, pricing verification date, production allow-list membership, baseline default behavior outside production, and startup rejection of a missing or unknown `GEMINI_MODEL_CONFIG` in production.

- [ ] Run `node --test test/gemini-config.test.mjs` and confirm it fails because the registry does not exist.

- [ ] Implement `services/geminiConfig.js` as the sole registry and export pure helpers:

  ```js
  getGeminiModelConfig(configId)
  resolveGeminiModelConfig({ nodeEnv, configId })
  buildThinkingConfig(config)
  listEvaluationConfigurations()
  estimateGeminiCostUsd(config, usageMetadata)
  ```

- [ ] Configure the four approved entries exactly as specified in the design. Cost calculation must bill visible candidate tokens plus `thoughtsTokenCount` at the output-token rate and must not double-count `totalTokenCount`.

- [ ] Replace the hard-coded model ID and thinking budget in `server.js` with the resolved request configuration. Resolve once at startup, fail clearly before listening in invalid production configuration, and log only the non-sensitive effective config ID and model metadata.

- [ ] Replace the candidate constants in `scripts/run-model-bakeoff.mjs` with imports from the same registry. Remove stale 3.1, preview, Pro, and old 3.5 candidates from this migration path.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  GEMINI_MODEL_CONFIG=unknown NODE_ENV=production node server.js
  ```

  The final command must exit non-zero before binding a port and must not print secrets.

- [ ] Commit:

  ```bash
  git add services/geminiConfig.js test/gemini-config.test.mjs server.js scripts/run-model-bakeoff.mjs
  git commit -m "feat: centralize Gemini model configuration"
  ```

**Gate:** Production and evaluation use one allow-listed registry, cost accounting includes thought tokens, and production cannot silently start with a missing or unknown model configuration.

---

## Task 4: Enforce the Caregiver Response Contract

**Files:**

- Create: `services/geminiResponse.js`
- Create: `test/gemini-response.test.mjs`
- Modify: `server.js`

- [ ] Add table-driven failing tests for:

  - valid plain JSON and fenced JSON arrays;
  - malformed JSON;
  - empty provider text;
  - non-array JSON;
  - missing, non-string, and whitespace-only `translation` values;
  - exact duplicates after trim and case normalization;
  - duplicates against More Ideas history;
  - duplicates against the variation source;
  - 3 and 4 valid suggestions for initial translation and More Ideas;
  - fewer than 3 or more than 4 suggestions for initial translation and More Ideas;
  - exactly 2 valid suggestions for variation;
  - every classified outcome: `success`, `timeout`, `api_error`, `empty_response`, `json_parse_failure`, `schema_failure`, `output_count_failure`, and `blocked_response`.

- [ ] Run `node --test test/gemini-response.test.mjs` and confirm the expected missing-module failure.

- [ ] Implement pure parsing and validation helpers in `services/geminiResponse.js`. Return a typed result object with either validated suggestions or a stable internal failure code; never return a partial list.

- [ ] Update `server.js` to use the validator for real Gemini responses. Initial translation and More Ideas must return 3 or 4 unique items. Variation must return exactly 2 unique items after source deduplication. Preserve existing user-visible error wording where it is already safe; normalize provider names, credential diagnostics, stack details, timeout internals, and parse details to the app's existing fallback message, `AI translation unavailable.`, plus a classified internal event. This is a safety normalization of an existing message, not new caregiver-facing copy.

- [ ] Preserve the existing pre-model Interest Based guardrail and all request validation.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  ```

- [ ] Commit:

  ```bash
  git add services/geminiResponse.js test/gemini-response.test.mjs server.js
  git commit -m "feat: validate Gemini response contract"
  ```

**Gate:** The server either returns a complete, mode-correct suggestion set or a safe error; malformed and partial model output cannot reach the interface.

---

## Task 5: Add Privacy-Safe Operational Telemetry and Health Checks

**Files:**

- Create: `services/geminiObservability.js`
- Create: `test/gemini-observability.test.mjs`
- Create: `test/server-health.test.mjs`
- Modify: `server.js`

- [ ] Add failing tests for a structured request event containing:

  ```text
  event, outcome, revision, config_id, model, thinking_level,
  thinking_budget, mode, variation_kind, duration_ms,
  prompt_token_count, candidates_token_count, thoughts_token_count,
  total_token_count, cached_content_token_count, suggestion_count,
  finish_reason, timestamp
  ```

  Tests must prove that prompt text, generated text, API keys, Redis values, challenge IDs, stack traces, and raw provider payloads are absent.

- [ ] Add a failing server test that launches the app in mock mode and asserts `GET /healthz` returns 200 with only:

  ```json
  {"status":"ok","configuration":"ready"}
  ```

  Add a production-mode configuration test asserting a non-ready startup exits before serving traffic.

- [ ] Run both new test files and confirm the expected failures.

- [ ] Implement the event builder and JSON logger in `services/geminiObservability.js`. Replace split success/error logging with one classified completion event per model attempt, while preserving non-model rate-limit events.

- [ ] Add `/healthz` before static serving. It must not call Gemini or Redis and must expose no values.

- [ ] Ensure timeout timers are cleared after success or failure so completed requests do not retain pending timers.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  ```

- [ ] Commit:

  ```bash
  git add services/geminiObservability.js test/gemini-observability.test.mjs test/server-health.test.mjs server.js
  git commit -m "feat: add Gemini migration telemetry"
  ```

**Gate:** Every model attempt has one privacy-safe classified event, health checks are free of model spend, and required production configuration fails closed.

---

## Task 6: Build the Reproducible Migration Evaluation Harness

**Files:**

- Create: `evals/gemini-migration-prompt-set.json`
- Create: `evals/results/gemini-migration/phase-3-spend.json`
- Create: `scripts/gemini-migration-eval-utils.mjs`
- Create: `test/gemini-migration-eval-utils.test.mjs`
- Modify: `scripts/run-model-bakeoff.mjs`
- Modify: `scripts/check-gemini-models.mjs`
- Modify: `scripts/check-get-more-ideas-multiround.mjs`
- Modify: `scripts/check-variation-prompts.mjs`
- Modify: `scripts/run-interest-generalization-check.mjs`
- Modify: `package.json`

- [ ] Build the migration corpus as an explicit manifest that imports every case from `evals/human-calibration-set.json`, `evals/gemini-translation-prompt-set.json`, `evals/get-more-ideas-prompt-set.json`, and `evals/variation-prompt-set.json`, then adds coverage not already present for every tone, Fewer Words, all five variation directions, three consecutive More Ideas rounds, safety, urgency, conflict, transition, cleanup, task sequencing, long/messy prompts, and the interests Minecraft, trains, Disney, Pokemon, dinosaurs, and cooking. Deduplicate only by stable case ID and record source provenance. The no-interest guardrail case must be marked `localOnly: true` and never call Gemini.

- [ ] Add failing tests for CLI configuration selection, exact all-candidate expansion, complete corpus import, repeat count, deterministic seed, local-only case exclusion, timestamped artifact naming, candidate metadata capture, cost calculation including thinking tokens, generation-plus-evaluator spend accumulation, persistent spend-ledger recovery across process restarts, aggregate gate calculation, and pre-call stop-before-cap behavior.

- [ ] Run `node --test test/gemini-migration-eval-utils.test.mjs` and confirm the expected failure.

- [ ] Implement shared evaluation utilities and update migration-related scripts to require an explicit allow-listed configuration or list of configurations. Preserve existing historical result files; write new timestamped artifacts under `evals/results/gemini-migration/` and update migration-specific `latest-*` pointers only. Before every candidate-generation or evaluator call, read `phase-3-spend.json`, estimate whether the next call fits within the remaining cumulative Phase 3 budget, stop before the call if it does not, and atomically persist actual spend after each response.

- [ ] Add scripts:

  ```json
  {
    "quality:migration-smoke": "node scripts/run-model-bakeoff.mjs --configurations=gemini-2.5-flash-baseline,gemini-3.5-flash-lite-minimal,gemini-3.6-flash-minimal,gemini-3.6-flash-medium --corpus=evals/gemini-migration-prompt-set.json --repeats=1 --limit=3 --phase-budget-usd=10.00 --spend-ledger=evals/results/gemini-migration/phase-3-spend.json",
    "quality:migration-eval": "node scripts/run-model-bakeoff.mjs --configurations=gemini-2.5-flash-baseline,gemini-3.5-flash-lite-minimal,gemini-3.6-flash-minimal,gemini-3.6-flash-medium --corpus=evals/gemini-migration-prompt-set.json --repeats=3 --phase-budget-usd=10.00 --spend-ledger=evals/results/gemini-migration/phase-3-spend.json"
  }
  ```

- [ ] Ensure the report contains per-run and aggregate counts, parse/contract errors, safety flags, Fewer Words compliance, interest leakage/grounding checks, median and p95 generation latency, prompt/visible/thought/total tokens, successful-request cost, evaluator cost, cumulative smoke-plus-full generation/evaluation spend, and the exact effective configuration metadata. The $10 stop must include all candidate-generation and automated-evaluator calls across every Phase 3 invocation.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  node scripts/run-model-bakeoff.mjs --help
  ```

  `--help` must not load an API key or make a paid call.

- [ ] Commit:

  ```bash
  git add evals/gemini-migration-prompt-set.json evals/results/gemini-migration/phase-3-spend.json scripts/gemini-migration-eval-utils.mjs test/gemini-migration-eval-utils.test.mjs scripts/run-model-bakeoff.mjs scripts/check-gemini-models.mjs scripts/check-get-more-ideas-multiround.mjs scripts/check-variation-prompts.mjs scripts/run-interest-generalization-check.mjs package.json
  git commit -m "feat: add reproducible Gemini migration evals"
  ```

**Gate:** The paid evaluator is explicit, reproducible, capped, configuration-aware, and unable to spend tokens for local-only guardrail cases.

---

## Task 7: Upgrade the Google Gen AI SDK While Remaining on 2.5 Flash

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify only if required by v2: `server.js`
- Modify only if required by v2: `scripts/*.mjs`
- Create: `docs/migrations/gemini/phase-2-sdk-validation.md`

- [ ] Record the exact current supported v2 release from the official package registry and official Google migration documentation in `docs/migrations/gemini/phase-2-sdk-validation.md`.

- [ ] Update `@google/genai` to that exact v2 version and install it so both manifest and lockfile agree. Do not use an unbounded `latest` range.

- [ ] Make only the compatibility changes required for v2. Keep the effective production config `gemini-2.5-flash-baseline` and keep prompts and schemas byte-for-byte unchanged.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  npm audit --omit=dev
  ```

- [ ] Run local mock-mode challenge-bypass checks for initial translation, More Ideas, all variations, and Interest Based guardrails.

- [ ] Run a deliberate real-API 2.5 Flash smoke set with at least one initial translation, one More Ideas request, and one variation. Record response-contract result, latency, token metadata, and config ID without recording prompt/output text.

- [ ] Commit:

  ```bash
  git add package.json package-lock.json server.js scripts/run-model-bakeoff.mjs scripts/check-gemini-models.mjs scripts/check-get-more-ideas-multiround.mjs scripts/check-variation-prompts.mjs scripts/run-interest-generalization-check.mjs docs/migrations/gemini/phase-2-sdk-validation.md
  git commit -m "chore: upgrade Google Gen AI SDK v2"
  ```

**Gate:** Deterministic checks and real 2.5 Flash smokes pass under SDK v2 with unchanged prompts and behavior.

---

## Task 8: Deploy and Verify the Phase 2 Safety Revision on 2.5 Flash

**Files:**

- Create: `docs/migrations/gemini/phase-2-production-validation.md`
- Modify: `docs/runbooks/gemini-migration-operations.md`

- [ ] Deploy the reviewed Phase 2 source as a tagged, zero-traffic Cloud Run revision with `GEMINI_MODEL_CONFIG=gemini-2.5-flash-baseline` and the three Secret Manager references.

- [ ] Verify `/healthz`, challenge issuance, translation, More Ideas, every variation direction, pre-model Interest Based rejection, response counts, rate limiting, structured outcome logs, and absence of prompt/output content in logs.

- [ ] Complete at least 20 supervised successful requests across modes on the tagged URL. Compare median latency, p95 latency, errors, thought tokens, and successful-request cost with the secret-managed Phase 1 baseline.

- [ ] Move 100% traffic to the Phase 2 revision only if all Phase 2 gates pass. Verify the Cloud Run traffic map and `https://declarativeapp.org`.

- [ ] Exercise rollback to the secret-managed Phase 1 revision, verify it, and restore the Phase 2 revision. Record exact revision IDs and evidence.

- [ ] Commit the operational evidence:

  ```bash
  git add docs/migrations/gemini/phase-2-production-validation.md docs/runbooks/gemini-migration-operations.md
  git commit -m "docs: verify Gemini migration safeguards"
  ```

**Gate:** The v2/config/validation/telemetry revision is healthy at 100% while still using 2.5 Flash, and one-step rollback is proven.

---

## Task 9: Refresh Candidate Facts and Run the Capped Candidate Evaluation

**Files:**

- Modify: `services/geminiConfig.js`
- Create: `docs/migrations/gemini/phase-3-evaluation.md`
- Generate: `evals/results/gemini-migration/*`

- [ ] Re-verify from official Google sources the availability, stable model IDs, thinking configuration support, deprecation status, and standard paid token prices for all four configurations. Update registry metadata and its verification date if facts changed; run all deterministic tests afterward.

- [ ] Initialize `phase-3-spend.json` at zero only if no Phase 3 paid call has occurred. Run `npm run quality:migration-smoke` across all four explicit configurations and the three-case manifest slice. Stop if model access, schema compatibility, spend-ledger accounting, or artifact generation is wrong. Never reset or replace the spend ledger to regain budget.

- [ ] Calculate expected full-run generation-plus-evaluator spend from smoke usage and subtract cumulative spend already recorded in `phase-3-spend.json`. If the projected run exceeds the remaining amount of the $10 cap, stop and ask Kyle before the full run.

- [ ] Run `npm run quality:migration-eval` once the estimate is within the cap. Do not alter prompts, corpus, SDK, evaluator, schemas, or thresholds between candidates.

- [ ] Independently verify artifact completeness, exact cumulative spend, no production data, no should-not-show outputs, no safety/task-sequence blockers, parse/contract error counts, Pass/Borderline/Fail counts per repeat, interest grounding, Fewer Words compliance, median/p95 latency, and successful-request cost.

- [ ] Enforce every automated quality threshold per repeat: zero should-not-show outputs; zero critical safety or task-sequence omissions; zero parse, empty-response, or output-count failures; zero Fail verdicts among 39 production-valid calibration cases; at least 36 Pass; no more than 3 Borderline; zero deterministic Interest Based grounding violations; zero cross-interest leakage; and no material Fewer Words regression.

- [ ] Enforce the performance and candidate-order rules: 3.5 Flash-Lite must pass quality and improve matched median generation latency by at least 15% or successful-request cost by at least 5%, with p95 no worse than 2.5. Evaluate 3.6 for selection only if 3.5 fails quality or 3.6 is materially preferred in blinded review; any 3.6 candidate must remain inside 30 seconds and p95 may not exceed the matched 2.5 p95 by more than 20% without Kyle's explicit exception approval.

- [ ] Write `docs/migrations/gemini/phase-3-evaluation.md` with:

  - a gate-by-gate table for each configuration;
  - evidence links to timestamped artifacts;
  - baseline-matched latency and cost deltas;
  - the strongest passing successor;
  - exact failure reasons for any blocked successor;
  - total paid spend;
  - a clear stop recommendation if no successor passes.

- [ ] Commit only the registry metadata, bounded evaluation artifacts, and report after checking that no secret or production prompt/output data is present:

  ```bash
  git add services/geminiConfig.js docs/migrations/gemini/phase-3-evaluation.md evals/results/gemini-migration
  git commit -m "test: evaluate Gemini migration candidates"
  ```

**Gate:** At least one successor passes every non-negotiable automated gate. If none passes, stop before production deployment and ask Kyle whether to authorize a separately controlled prompt-compatibility pass.

---

## Task 10: Produce the Blinded Product Decision Packet

**Files:**

- Create: `scripts/build-gemini-migration-review-packet.mjs`
- Create: `test/build-gemini-migration-review-packet.test.mjs`
- Generate: `evals/results/gemini-migration/blinded-review-packet.json`
- Generate: `evals/results/gemini-migration/blinded-review-packet.md`
- Create: `docs/migrations/gemini/phase-4-decision.md`

- [ ] Add failing tests proving the packet uses stable anonymized labels, deterministic randomized ordering, concealed model/config names, full inclusion of Fail/Borderline/disagreement/high-risk cases, a 25% seeded sample of unanimous passes, and no hidden identity leak in headings or metadata.

- [ ] Run the packet test and confirm the expected missing-script failure.

- [ ] Implement the packet builder using the Phase 3 artifacts. Include paired outputs, concise scenario context, safety/task-coverage prompts, a baseline/candidate preference control, and a blocker reason control. Keep model identities in a separate uncommitted answer key until Kyle completes review.

- [ ] Run:

  ```bash
  npm test
  node scripts/build-gemini-migration-review-packet.mjs
  status=0
  rg -ni "gemini-|2\\.5|3\\.5|3\\.6|flash(?:-lite)?|thinking(?:level|budget)|config(?:uration)?_id|minimal thinking|medium thinking|\\$0\\.30|\\$1\\.50|\\$2\\.50|\\$7\\.50" evals/results/gemini-migration/blinded-review-packet.* || status=$?
  test "$status" -eq 1
  ```

  The final scan succeeds only when `rg` returns exactly 1, meaning it found no identity-bearing model, configuration, thinking, version, or pricing string. An `rg` execution error must fail the check.

- [ ] Give Kyle the blinded packet plus a non-technical explanation of the decision rules. Kyle must review the pairings and explicitly select one passing configuration or reject all.

- [ ] After Kyle decides, reveal identities and write `docs/migrations/gemini/phase-4-decision.md` with preference rates, any blocker choices, selected configuration, measured tradeoffs, and the decision timestamp.

- [ ] Commit:

  ```bash
  git add scripts/build-gemini-migration-review-packet.mjs test/build-gemini-migration-review-packet.test.mjs evals/results/gemini-migration/blinded-review-packet.json evals/results/gemini-migration/blinded-review-packet.md docs/migrations/gemini/phase-4-decision.md
  git commit -m "docs: record Gemini migration decision"
  ```

**Gate:** Kyle explicitly approves one passing configuration, it wins or ties at least 90% of reviewed pairings, and no safety or critical task-coverage preference favors the baseline. Otherwise stop.

---

## Task 11: Prepare the Selected Candidate Rollout and Rollback Controls

**Files:**

- Modify: `docs/runbooks/gemini-migration-operations.md`
- Create: `docs/migrations/gemini/phase-5-rollout.md`
- Create: `test/production-config-contract.test.mjs`

- [ ] Add a deterministic production-contract test that resolves the user-approved config ID, verifies its exact model/thinking settings, confirms the secret names and environment variable names expected by Cloud Run, and verifies the secret-managed 2.5 baseline remains allow-listed for pre-shutdown rollback.

- [ ] Add exact no-traffic deployment, tagged smoke, traffic promotion, rollback, log-query, and custom-domain verification commands to the runbook. The deploy command must not be the existing immediate-traffic `npm run deploy` command.

- [ ] Define the canary scoreboard in `docs/migrations/gemini/phase-5-rollout.md` with baseline and candidate fields for request count, success count, 5xx rate, timeout rate, parse/contract failures, safety/task issues, median latency, p95 latency, prompt/visible/thought tokens, and successful-request cost.

- [ ] Define objective promotion rules: zero candidate-attributable safety, task-sequence, parse, schema, empty-response, or output-count failures; zero unexplained candidate-attributable 5xx or timeout events; p95 inside the approved Phase 3 limit; successful-request cost no more than 10% above the approved estimate; and no unresolved incident. Any first 5xx/timeout pauses promotion for classification; a repeatable or candidate-attributable event triggers rollback. A documented platform-wide failure that affects baseline and candidate equally may be excluded only with evidence in the scoreboard.

- [ ] Define the exact promotion stages and minimum evidence:

  ```text
  tagged 0%: 20 supervised successes
  1%: immediate technical check and log confirmation
  5%: at least 24 hours and 20 candidate successes
  25%: at least 24 hours and 50 candidate successes
  100%: at least 72 hours observation
  ```

- [ ] Copy all rollback triggers from the approved design into the operational checklist. Include both pre-October-16 rollback to the secret-managed 2.5 revision and post-shutdown rollback to a healthy passing successor.

- [ ] Run:

  ```bash
  npm test
  npm run lint
  npm run build
  git diff --check
  ```

- [ ] Commit:

  ```bash
  git add docs/runbooks/gemini-migration-operations.md docs/migrations/gemini/phase-5-rollout.md test/production-config-contract.test.mjs
  git commit -m "docs: prepare Gemini canary rollout"
  ```

**Gate:** The selected configuration is exact, rollback is one documented operation, every promotion has measurable entry/exit criteria, and the 2.5 production baseline remains untouched.

---

## Task 12: Run the Tagged Candidate and Staged Production Canary

**Files:**

- Modify after each stage: `docs/migrations/gemini/phase-5-rollout.md`

- [ ] Deploy the selected commit as a tagged, zero-traffic revision using the selected `GEMINI_MODEL_CONFIG` and existing Secret Manager references.

- [ ] Verify `/healthz`, challenge, initial translation, More Ideas, all variation directions, all tones, Fewer Words, Interest Based guardrail, rate limiting, structured logs, and the effective model/thinking configuration on the tagged URL.

- [ ] Complete at least 20 supervised successful tagged requests. Immediately roll back or stop for any safety, sequence, schema, parse, empty-response, timeout, latency, or unexplained cost trigger.

- [ ] Move traffic to 1%. Verify the exact traffic map, candidate logs, baseline availability, and `https://declarativeapp.org`.

- [ ] If every objective promotion rule passes, move to 5% and hold for both at least 24 hours and at least 20 successful candidate requests. Record the canary scoreboard and compare with the secret-managed baseline.

- [ ] If every objective promotion rule passes, move to 25% and hold for both at least 24 hours and at least 50 successful candidate requests. Record and compare the scoreboard again.

- [ ] If normal traffic cannot satisfy the time-and-count gates before September 30, stop for Kyle to choose whether to authorize a supervised full-traffic window.

- [ ] If every objective promotion rule and stage gate passes, move to 100%, verify the Cloud Run traffic map, effective config logs, and custom domain, then begin the 72-hour observation window.

- [ ] Commit operational evidence after each durable stage without prompt/output content:

  ```bash
  git add docs/migrations/gemini/phase-5-rollout.md
  git commit -m "ops: record Gemini canary stage"
  ```

**Gate:** The selected successor serves 100% of production traffic and enters a 72-hour observation window with no active rollback trigger.

---

## Task 13: Complete Observation, Credential Decisions, and Project Handoff

**Files:**

- Create: `docs/migrations/gemini/migration-completion.md`
- Modify: `docs/runbooks/gemini-migration-operations.md`
- Modify: `README.md`

- [ ] Observe 100% production for at least 72 hours. Record request count, error/timeout/contract rates, median and p95 latency, thought-token use, successful-request cost, safety/task reports, exact revision, and custom-domain status.

- [ ] If any rollback trigger fires, immediately restore the documented healthy revision, verify Cloud Run and the custom domain, document the trigger, and reopen the relevant gate.

- [ ] When observation passes, update `README.md` and the operations runbook with the final production config ID, health/log commands, rollback target, and the rule that `npm run deploy` alone must not be used for model migrations.

- [ ] Present Kyle with separate plain-language decisions for:

  1. revoking the old Gemini credential;
  2. revoking/replacing old Upstash credentials if rotation was completed;
  3. deleting historical Cloud Run revisions that may retain literal secret values.

  Do not perform any of these irreversible actions without explicit approval immediately beforehand.

- [ ] Write `docs/migrations/gemini/migration-completion.md` with the final model and thinking configuration, why it won, measured quality/latency/cost changes, rollout history, rollback path, credential states, remaining risks, and completion timestamp.

- [ ] Run final verification:

  ```bash
  npm test
  npm run lint
  npm run build
  npm audit --omit=dev
  git diff --check
  ```

- [ ] Obtain a fresh broad code, security, operational, and spec-compliance review. Resolve every material finding and rerun the relevant verification.

- [ ] Commit:

  ```bash
  git add README.md docs/runbooks/gemini-migration-operations.md docs/migrations/gemini/migration-completion.md
  git commit -m "docs: complete Gemini model migration"
  ```

**Completion gate:** One approved successor has served 100% of production traffic for 72 hours without a rollback trigger; `declarativeapp.org` is verified; production logs show the intended configuration; the rollback path, credential state, measured tradeoffs, and remaining contingency are documented; and Kyle has received the final report.

---

## Phase Decision Summary for Kyle

The project pauses for Kyle only at decisions that materially change risk, cost, or product quality:

1. **Credential revocation:** irreversible; approve only after replacement credentials and rollback are proven.
2. **Evaluation spend above $10:** approve only with a clear explanation of why more evidence is worth the cost.
3. **No passing successor:** choose whether to authorize a prompt-compatibility project rather than weakening quality gates.
4. **Production candidate:** choose from the blinded quality packet after automated gates pass.
5. **Gate exception:** approve only with the exact user impact, likelihood, and rollback option stated plainly.
6. **Insufficient canary traffic:** decide whether a supervised full-traffic window is preferable to delaying migration.
7. **Historical revision deletion:** irreversible cleanup after a healthy rollback revision exists.

All other implementation, testing, evaluation within the cap, tagged deployment, and staged promotion work is authorized by the approved design and this plan.
