# Gemini Model Migration Design

**Status:** Approved design direction; written specification awaiting final user review

**Owner:** Codex, acting as project manager

**Product decision owner:** Kyle Wegner

**Date:** 2026-08-13

## 1. Objective

Migrate Declarative from `gemini-2.5-flash` before Google shuts that model down on October 16, 2026, without diminishing the app's caregiver-language quality, safety, reliability, or usability.

The project will compare:

1. `gemini-2.5-flash` with `thinkingBudget: 0` as the production baseline.
2. `gemini-3.5-flash-lite` with `thinkingLevel: "minimal"` as the preferred value candidate.
3. `gemini-3.6-flash` with `thinkingLevel: "minimal"` as a speed-oriented quality fallback.
4. `gemini-3.6-flash` with `thinkingLevel: "medium"` as the maximum-quality fallback configuration.

If 3.5 Flash-Lite and 3.6 Flash are tied on quality, 3.5 Flash-Lite wins because it preserves the current token prices. If 3.5 Flash-Lite fails a quality gate and a 3.6 Flash configuration passes, 3.6 Flash becomes the recommended target despite its higher price.

Standard paid token prices verified from Google's documentation on 2026-08-13 are:

- 2.5 Flash: $0.30 per million input tokens and $2.50 per million output tokens.
- 3.5 Flash-Lite: $0.30 per million input tokens and $2.50 per million output tokens.
- 3.6 Flash: $1.50 per million input tokens and $7.50 per million output tokens.

These rates will be refreshed immediately before Phase 3. The evaluation report will use the refreshed rates if Google changes them.

## 2. Non-Negotiable Principles

- No direct production model-ID flip.
- Do not change prompts during the model comparison. The model must be the isolated variable.
- Do not combine credential migration, SDK migration, model migration, and public rollout in one revision.
- Keep the existing one-request `generateContent` architecture during this project.
- Do not adopt the Interactions API or multi-turn thought-history behavior.
- Do not log caregiver prompts, generated suggestions, API keys, Redis credentials, or thought signatures.
- Automated evaluation may prioritize review, but Kyle owns the final quality decision.
- Every production-affecting phase must have a verified rollback path before it begins.
- Production is not considered migrated until Cloud Run traffic and `declarativeapp.org` are verified after deployment.

## 3. Current-State Baseline

Production currently uses `gemini-2.5-flash` with thinking disabled. The model ID is hard-coded in the request and repeated in usage logging. The current Cloud Run service sends 100% of traffic to revision `declarative-00102-5l7`.

The latest 40-case model baseline contains 39 production-valid cases and one guardrail-only case. Its aggregate result is:

- Pass: 36
- Borderline: 3
- Fail: 0
- Should-not-show outputs: 0
- API errors: 0
- Average generation latency: 1,060 ms
- Estimated generation cost: $0.0209 for the complete run

The project treats this result as the quality floor, not as a prediction of future runs.

The existing automated evaluator is a triage tool. It has not demonstrated sufficient agreement with Kyle's judgments to approve a model independently.

## 4. Scope

### In scope

- Secure handling of the Gemini and Upstash credentials used by Cloud Run.
- A known-good, secret-managed 2.5 Flash rollback revision.
- Central model and thinking configuration shared by production and evaluation tools.
- An SDK v2 upgrade tested separately while production remains on 2.5 Flash.
- Deterministic response-contract validation and failure classification.
- Migration-specific structured logging and operational health checks.
- Repeatable comparison of all four model configurations.
- Evaluation of initial translation, More Ideas, one-tap variations, Fewer Words, every tone, safety redirection, multi-step prompts, and interest generalization.
- Blinded human review and an explicit Kyle decision gate.
- Tagged, no-traffic deployment; staged canary; rollback; and custom-domain verification.
- A written rollout and rollback runbook.

### Out of scope

- Rewriting the translation prompt during the candidate comparison.
- Changing the app's visible interface or caregiver-facing copy.
- Adopting the Gemini Interactions API.
- Adding function calling, tool use, or stored model conversation history.
- Building a general-purpose experimentation platform.
- Automatically logging or reviewing real user prompt/output content.
- Implementing automatic cross-model failover before a demonstrated need exists.
- Unrelated refactoring of `server.js` or the React application.

## 5. Architecture

### 5.1 Model configuration

One server-side model registry will define the supported model ID, thinking configuration, and current pricing metadata for each approved configuration.

Production will choose one allow-listed configuration through a runtime environment variable. An invalid or absent production value will fail startup clearly rather than silently selecting an unknown model. Local development may default to the current 2.5 Flash baseline.

The same registry will be consumed by the evaluation tools so production and bakeoff settings cannot drift.

The effective model and thinking configuration will be logged from the actual request configuration, rather than from a second hard-coded string.

### 5.2 Request flow

The request architecture remains:

1. Client obtains a one-time challenge token.
2. Client sends one `/api/translate` request.
3. Server validates the request mode and inputs.
4. Server builds the existing translation or variation prompt.
5. Server makes one Gemini `generateContent` request.
6. Server parses and validates the structured response.
7. Server returns only validated suggestions.

More Ideas and one-tap variations remain new stateless requests. Thought-signature circulation is therefore not required for the current architecture.

### 5.3 Response validation

The API response contract will require:

- Initial translation and More Ideas: 3 or 4 non-empty suggestions.
- Variation: exactly 2 non-empty suggestions after source deduplication.
- Every item contains only a non-empty `translation` string.
- Exact duplicates are rejected.
- A response that cannot meet the mode's count requirement is treated as a structured model-output failure and is not partially displayed.

The server will classify and log:

- API error
- timeout
- empty response
- JSON parse failure
- schema or output-count failure
- safety or blocked-response finish reason when returned by Gemini
- success

User-facing errors remain calm and do not expose provider details or secrets.

### 5.4 Observability

Each request event will include:

- event type and outcome
- Cloud Run revision
- effective model ID
- thinking level or thinking budget
- request mode and variation kind
- duration
- prompt tokens
- visible candidate tokens
- thinking tokens
- total tokens
- cached tokens when available
- returned suggestion count
- provider finish reason when available

No event will include the caregiver prompt or generated text.

A non-model `/healthz` endpoint will confirm the server is running and that required configuration is present. It will not call Gemini or expose configuration values.

## 6. Gated Project Phases

### Phase 1: Secure baseline and rollback target

Purpose: create a safer production baseline without changing model behavior.

Work:

1. Create Secret Manager entries for Gemini and Upstash credentials.
2. Use provider-supported credential overlap where available.
3. Deploy an otherwise unchanged 2.5 Flash revision that references Secret Manager.
4. Verify challenge, translation, More Ideas, variation, rate-limit, and custom-domain behavior.
5. Confirm usage logs still report `gemini-2.5-flash` and no thought tokens.
6. Rotate credentials one provider at a time only after the secret-managed revision is healthy.
7. Revoke old credentials only after Kyle approves the irreversible revocation step.

Gate to Phase 2:

- Secret-managed 2.5 Flash revision is healthy at 100% traffic.
- New credentials work and old credentials have a documented revocation state.
- Rollback to the secret-managed 2.5 revision has been verified operationally.
- No model, SDK, prompt, or response behavior changed in this phase.

### Phase 2: Migration controls and deterministic safeguards

Purpose: make model changes testable and reversible while the production model stays on 2.5 Flash.

Work:

1. Add the central model registry and allow-listed runtime selection.
2. Add deterministic unit tests using Node's built-in test runner.
3. Add response parsing and contract validation tests before implementation changes.
4. Add structured success/failure logging and `/healthz`.
5. Update evaluation cost accounting to include thinking tokens.
6. Make migration eval scripts accept an explicit model configuration instead of hard-coding 2.5 Flash.
7. Upgrade `@google/genai` to the current supported v2 release as a separate change.
8. Run the complete deterministic suite, TypeScript validation, build, mock-mode flow, and real 2.5 Flash smoke test.
9. Deploy the SDK/configuration revision while retaining the 2.5 Flash model.

Gate to Phase 3:

- All deterministic tests, TypeScript validation, and production build pass.
- Production remains on 2.5 Flash.
- Real API responses still satisfy the established output contract.
- Structured logs distinguish all defined outcomes.
- Switching back to the baseline configuration is one documented runtime or revision operation.

### Phase 3: Controlled candidate evaluation

Purpose: determine whether either successor preserves or improves the current experience.

Candidate configurations:

- 2.5 Flash, thinking budget 0
- 3.5 Flash-Lite, minimal thinking
- 3.6 Flash, minimal thinking
- 3.6 Flash, medium thinking

Evaluation corpus:

- All 40 human-calibration cases, including the no-interest guardrail case.
- All current broader prompt-set cases.
- All one-tap variation directions.
- Three consecutive More Ideas rounds.
- Minecraft, trains, Disney, Pokemon, and at least two additional interests selected from ordinary caregiver use cases.
- Longer and messy multi-part prompts.
- Safety, urgency, conflict, transition, cleanup, and emotionally charged cases.

Execution rules:

- Run each production-valid calibration case three times per configuration.
- Run the guardrail-only no-interest case without spending model tokens and confirm the server rejects it.
- Hold prompts, schemas, SDK version, evaluator version, and deterministic gates constant.
- Cap Phase 3 Gemini API spending at $10. Stop and ask Kyle before exceeding the cap.
- Store timestamped raw evaluation artifacts locally without caregiver production data.

Automated go gate for a candidate:

- Zero should-not-show outputs.
- Zero critical safety or task-sequence omissions.
- Zero parse, empty-response, or output-count errors across the calibration runs.
- Zero Fail verdicts among production-valid calibration cases in each repeat.
- At least 36 Pass and no more than 3 Borderline cases in each repeat.
- No deterministic Interest Based grounding violation.
- No cross-interest leakage.
- No material regression in Fewer Words length compliance.

Performance gate:

- 3.5 Flash-Lite must preserve quality and either improve median generation latency by at least 15% or reduce measured cost per successful request by at least 5%.
- 3.5 Flash-Lite p95 generation latency must not be worse than the matched 2.5 baseline.
- 3.6 Flash is considered only if 3.5 Flash-Lite fails a quality gate or if 3.6 is materially preferred in blinded quality review.
- A 3.6 configuration must remain within the existing 30-second app timeout and must not increase matched p95 generation latency by more than 20% without Kyle's explicit approval.
- All cost comparisons include thinking tokens.

Adaptive follow-up:

If 3.5 Flash-Lite minimal thinking narrowly misses only a non-safety quality threshold while showing a clear speed advantage, a separate 3.5 Flash-Lite `low` or `medium` thinking test may be proposed. It will not run without Kyle's approval because it changes the cost/latency tradeoff.

Gate to Phase 4:

- At least one successor passes every non-negotiable quality gate.
- Evaluation artifacts and costs are complete and reproducible.
- No prompt changes were made to rescue one candidate during comparison.

If every successor fails:

- Stop before any production model deployment.
- Present Kyle with the exact failing dimensions, the strongest candidate, and the deadline risk.
- Ask Kyle whether to begin a separately controlled compatibility pass that permits prompt changes for supported models.
- Any compatibility pass must compare the revised prompt against all remaining candidates, repeat the full quality gates, and receive a new blinded-review approval.
- Do not weaken safety, task-coverage, should-not-show, parse, or response-contract gates to meet the deadline.

### Phase 4: Blinded product decision

Purpose: convert technical evidence into a product decision Kyle can make confidently.

The review packet will conceal model names and randomize ordering. It will include:

- Every automated Fail or Borderline result.
- Every disagreement between the baseline and a candidate.
- Every high-risk safety, sequence, Interest Based, Equalizing, Humorous, and Fewer Words case.
- Every multi-round More Ideas and one-tap variation concern.
- A randomized 25% sample of unanimous automated passes.
- Plain-language summaries of latency and estimated cost.

Human quality gate:

- No candidate output is approved if it introduces shame, manipulation, unsafe redirection, lost task steps, invented interest-world objects, or a material tone regression.
- The candidate must win or tie at least 90% of reviewed pairings.
- Any baseline preference caused by safety, critical task coverage, or pressure blocks that candidate.
- Kyle selects the production candidate or rejects all candidates.

Gate to Phase 5:

- Kyle explicitly approves one model configuration for canary deployment.
- The rollout recommendation states why the candidate is preferable and what tradeoffs remain.

### Phase 5: Tagged deployment, canary, and completion

Purpose: validate the chosen configuration under production conditions with immediate rollback.

Work:

1. Deploy a new Cloud Run revision with zero public traffic and a revision tag.
2. Test the tagged revision end to end with real challenge tokens.
3. Complete at least 20 successful supervised requests spanning translation, More Ideas, and variations.
4. Move traffic through 1%, 5%, 25%, and 100% stages.
5. At 5% and 25%, hold for at least 24 hours and collect at least 20 and 50 successful candidate requests respectively. If traffic is too low to meet both time and count requirements before the migration deadline, pause for a Kyle decision on a supervised full-traffic window.
6. At each stage, compare error rate, timeout rate, parse/contract failures, median latency, p95 latency, and cost per successful request against the secret-managed baseline.
7. Verify Cloud Run revision traffic and `declarativeapp.org` after every promotion or rollback.
8. After 100%, monitor for at least 72 hours before declaring the migration complete.

Immediate rollback triggers:

- Any should-not-show or critical safety failure observed in supervised testing.
- Any repeatable loss of task sequence or destination.
- Any unexplained schema, parse, empty-response, or output-count failure.
- A statistically meaningful increase in user-visible 5xx or timeout rate.
- Candidate p95 latency breaches its Phase 3 gate.
- Cost per successful request exceeds the approved candidate estimate by more than 10% without an understood cause.

Rollback behavior:

- Before October 16, 2026, move 100% traffic to the secret-managed 2.5 Flash rollback revision.
- After October 16, do not rely on 2.5 Flash. Use the other passing successor configuration if one exists, or roll back to the most recent healthy revision that uses the selected successor.
- A rollback changes traffic or the allow-listed model configuration; it does not require prompt edits.

Completion gate:

- One successor serves 100% of production traffic.
- The custom domain is verified.
- Production logs show the intended model and thinking configuration.
- The 72-hour observation window passes without a rollback trigger.
- The rollout/rollback runbook reflects the final production state.
- Kyle is informed of the final model, measured performance, actual tradeoffs, and remaining contingency path.

## 7. Testing Strategy

### Deterministic tests

Use Node's built-in test runner for tests that do not require an API key:

- model allow-list and environment selection
- model-specific thinking configuration
- startup rejection of invalid production configuration
- response parsing and mode-specific count rules
- duplicate and empty suggestion rejection
- finish-reason and failure classification
- token and cost accounting including thinking tokens
- health endpoint behavior
- structured log field construction without sensitive content
- production/evaluation configuration parity
- existing Interest Based guardrails

Every production behavior change follows test-first development: write the test, confirm it fails for the intended reason, implement the smallest passing change, and run the complete deterministic suite.

### Live-model evaluation

Live Gemini calls are evaluation evidence, not deterministic CI tests. They will be run intentionally, recorded with model/configuration metadata, and kept outside normal no-key checks.

### Production-like checks

- local mock mode
- local real Gemini mode with challenge bypass
- full Upstash-backed challenge parity
- tagged Cloud Run revision
- public custom domain

## 8. Security Design

- Gemini and Upstash secrets must be supplied through Secret Manager references, not literal Cloud Run environment values.
- Secret values must never appear in command output, logs, committed files, design documents, test fixtures, review packages, or subagent prompts.
- Credential rotation happens one provider at a time.
- Old credentials are not revoked until the new secret-managed revision passes end-to-end checks.
- Revocation is treated as an irreversible external action and requires Kyle's explicit approval immediately before execution.
- Historical revisions that contain literal secrets will be retained only as long as required for safe transition, then reviewed for deletion after the new rollback path is established. Deleting revisions is a separate explicitly approved action.

## 9. Project Governance

Codex will act as project manager and will:

- maintain the implementation plan and recovery ledger
- dispatch one implementation subagent per task
- require independent spec and quality review after every task
- use fresh reviewers rather than accepting implementer self-review
- integrate only reviewed changes
- stop for Kyle when product judgment, a destructive external action, unexpected cost, or a plan contradiction requires a decision
- report partial or blocked outcomes honestly

Kyle decision points:

1. Approve revocation of each old credential.
2. Approve any evaluation spend above $10.
3. Review and select the candidate in Phase 4.
4. Approve a supervised full-traffic window if normal canary traffic is insufficient.
5. Approve any candidate that exceeds a documented latency or cost gate.
6. Approve deletion of historical Cloud Run revisions containing literal credentials.

Routine implementation, tests, local evaluation within the cap, tagged deployment, and pre-approved canary stages do not require repeated permission unless evidence triggers a stop condition.

## 10. Target Schedule

- Phase 1 complete target: August 21, 2026
- Phase 2 complete target: August 31, 2026
- Phase 3 complete target: September 11, 2026
- Phase 4 decision target: September 16, 2026
- Phase 5 canary start target: September 18, 2026
- 100% migration target: September 30, 2026
- Contingency buffer before 2.5 Flash shutdown: October 1-15, 2026

These are project targets, not permission to bypass a quality gate. If a gate cannot pass by its target date, Codex will surface the specific evidence and available tradeoff to Kyle.

## 11. Success Definition

The project succeeds when Declarative is running a supported Gemini successor at 100% traffic, the existing caregiver experience has no measured quality or safety regression, production observability and rollback are verified, credentials are no longer supplied as literal Cloud Run environment values, and Kyle has approved the model based on blinded app-specific evidence.
