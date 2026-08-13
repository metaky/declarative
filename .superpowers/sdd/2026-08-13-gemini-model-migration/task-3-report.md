# Task 3 Report — Shared Allow-Listed Gemini Model Registry

## Status

`COMPLETE`

Task 3 adds only local source and deterministic-test controls. No cloud calls, paid Gemini calls, deployments, traffic changes, or credential changes were made.

## Commit

- `49e45fe9e3d3b54309bce12a2d84ecaf8d52f7b6` — `feat: centralize Gemini model configuration`
- Commit contents: exactly `services/geminiConfig.js`, `test/gemini-config.test.mjs`, `server.js`, and `scripts/run-model-bakeoff.mjs`.

## Changed files

- `services/geminiConfig.js` — sole four-entry allow-listed registry and pure resolution, thinking-request, evaluation-list, and token-cost helpers.
- `test/gemini-config.test.mjs` — Node built-in tests for observable registry, local-default, startup rejection, and cost behavior.
- `server.js` — startup-time configuration resolution, resolved Gemini request settings, and non-sensitive effective-config logging.
- `scripts/run-model-bakeoff.mjs` — shared registry candidates, shared thinking configuration, and thought-token-aware cost estimation.

## RED failure evidence

1. `node --test test/gemini-config.test.mjs` initially failed with `ERR_MODULE_NOT_FOUND` for `services/geminiConfig.js`. This confirmed the requested registry did not yet exist.
2. After the pure registry reached green, the real server-startup test initially failed: `server kept running instead of rejecting the unknown production configuration`. The test stopped the bound server after one second, proving the original `server.js` did not fail before binding.

## GREEN and final verification

- `node --test test/gemini-config.test.mjs` — 6 passing tests, 0 failures.
- `npm test` — 7 passing tests, 0 failures.
- `npm run lint` — passed (`tsc`).
- `npm run build` — passed (Vite production build).
- `GEMINI_MODEL_CONFIG=unknown NODE_ENV=production node server.js` — exited non-zero during module startup with `GEMINI_MODEL_CONFIG is unknown or not allowed in production: unknown`; no `Server listening on port` line and no secret output.
- `git diff --check` — passed before commit.

## Behavior preservation notes

- Non-production with no `GEMINI_MODEL_CONFIG` resolves to `gemini-2.5-flash-baseline`, preserving `gemini-2.5-flash` and `thinkingBudget: 0` in the actual request.
- Production requires a known allow-listed configuration before `app.listen`; both missing and unknown values are rejected.
- Prompts, system instruction, response schema, Gemini client construction, visible behavior, SDK version, and all secrets remain unchanged.
- The registry contains exactly these four approved configurations: `gemini-2.5-flash-baseline`, `gemini-3.5-flash-lite-minimal`, `gemini-3.6-flash-minimal`, and `gemini-3.6-flash-medium`.
- Cost estimation charges `promptTokenCount` at the input rate and `candidatesTokenCount + thoughtsTokenCount` at the output rate. `totalTokenCount` is not used, preventing double-counting.
- Startup logs only non-sensitive configuration ID, model, thinking settings, and pricing-verification date.

## Concerns

- The Vite build continues to warn that Browserslist data is old and that two bundles exceed the 500 kB advisory threshold. These are unrelated pre-existing build warnings and are outside Task 3 scope.
- Pricing metadata is verified as of `2026-08-13`; the approved migration design requires refreshing these rates before Phase 3 paid evaluation.
- The report is intentionally uncommitted because Task 3's required commit is explicitly limited to the four implementation files.

## Fix Round 1

### Status

`COMPLETE`

This round addresses only the three specified Important findings. No cloud calls, paid Gemini calls, SDK changes, prompt changes, deployments, traffic changes, or credential changes were made. The two Minor suggestions remain deferred as directed.

### Changes

- `scripts/run-model-bakeoff.mjs` now normalizes `--score-latest` and `--rebuild-latest` payloads against the exact current registry before scoring, summarizing, or overwriting `latest`. The rewritten candidate metadata is the current four-entry registry, and result rows for stale candidate IDs are removed.
- Bakeoff JSON summaries now report `candidateOutputTokens`, `thoughtTokens`, and `billedOutputTokens`. Markdown labels visible candidates, thoughts, and billed output `(Candidates + Thoughts)` separately in summaries, per-result reporting, and evaluator-token reporting.
- `test/gemini-config.test.mjs` adds a child-process assertion that missing `GEMINI_MODEL_CONFIG` in production exits non-zero without printing `Server listening on port`.
- `test/model-bakeoff.test.mjs` creates and loads a controlled legacy `latest-model-bakeoff.json` fixture, then proves only the four registry IDs and their matching result rows survive normalization. It also verifies hand-derived prompt, visible-output, thought, billed-output, and cost reporting values.

### RED and GREEN evidence

- RED: `node --test test/model-bakeoff.test.mjs` initially failed with `SyntaxError: ... does not provide an export named 'normalizeBakeoffPayloadForCurrentRegistry'`. This showed the old script had no testable local normalization boundary and could preserve stale metadata/rows during latest-artifact rebuilds.
- GREEN focused: `node --test test/model-bakeoff.test.mjs test/gemini-config.test.mjs` — 9 passing tests, 0 failures.
- Final: `npm test` — 10 passing tests, 0 failures; `npm run lint` — passed; `npm run build` — passed; `git diff --check` — passed.
- `GEMINI_MODEL_CONFIG=unknown NODE_ENV=production node server.js` exited non-zero before binding with the unknown-config error and no listener message.
- `env -u GEMINI_MODEL_CONFIG NODE_ENV=production node server.js` exited non-zero before binding with the missing-config error and no listener message.

### Commit

- This report and the Fix Round 1 source/test changes are committed together after the final verification recorded above. The original Task 3 implementation commit intentionally excluded this report; this round explicitly includes the requested report append.

### Concerns

- The existing Vite build warnings for outdated Browserslist data and bundle-size advisories remain outside this round's scope.
- Pricing remains marked verified on `2026-08-13` and must be refreshed before Phase 3 paid evaluation.
- The two reviewer Minor suggestions are deliberately deferred and were not changed in this round.
