# Gemini Migration Phase 1 Baseline

Captured on 2026-08-13 before Task 1 changes. This record contains no credential values.

## Repository control plane

- Starting commit: `c8c24809d7849f68041626945ff9fdcff43e4b18` (`chore: ignore migration workspaces`)
- Active branch: `codex/gemini-model-migration-implementation`
- Working tree at capture: clean

## Production service state

- Cloud Run service: `declarative`
- Google Cloud project: `gen-lang-client-0598048123`
- Region: `us-west1`
- Service URL: `https://declarative-acmdbbp4hq-uw.a.run.app`
- Revision receiving 100% of traffic: `declarative-00102-5l7`
- Current production model: `gemini-2.5-flash`
- Current thinking configuration: `thinkingBudget: 0`
- Custom domain: `https://declarativeapp.org/` returned HTTP 200 on 2026-08-13.

## Credential-reference baseline

The application currently expects the environment variable names `GEMINI_API_KEY`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN`. No values were queried or recorded.

The Secret Manager containers planned for Phase 2 are:

- `declarative-gemini-api-key` — not yet created or referenced by this Task 1 baseline.
- `declarative-upstash-redis-rest-url` — not yet created or referenced by this Task 1 baseline.
- `declarative-upstash-redis-rest-token` — not yet created or referenced by this Task 1 baseline.

Reference status is intentionally limited to names and presence: no Secret Manager version, credential literal, or credential value is recorded here.

## Latest quality baseline

The approved 40-case model baseline has 39 production-valid cases and one guardrail-only case. It is the quality floor, not a prediction of future runs.

| Metric | Baseline |
| --- | ---: |
| Pass | 36 |
| Borderline | 3 |
| Fail | 0 |
| Should-not-show outputs | 0 |
| API errors | 0 |
| Average generation latency | 1,060 ms |
| Estimated generation cost for complete run | $0.0209 |

The automated evaluator is a triage tool and is not independently sufficient for product approval.

## Task 1 boundary

Task 1 adds local controls and documents this baseline only. It does not deploy a revision, alter Cloud Run traffic, change a custom-domain mapping, create a secret, or change production behavior.
