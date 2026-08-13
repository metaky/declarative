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

## Task 2 secret-managed rollback baseline

Status on 2026-08-13: `DONE_WITH_CONCERNS`. The required secret-managed Gemini 2.5 Flash rollback path is healthy and production is using the verified replacement Gemini credential. Upstash remains on its original active credential because a safe overlapping ACL token could not be completed through the available non-interactive control path.

### Verified control plane

- Active account: `kyle.wegner@gmail.com`
- Explicit project on every operation: `gen-lang-client-0598048123`
- Service and region: `declarative`, `us-west1`
- Runtime service account: `1083695383503-compute@developer.gserviceaccount.com`
- Secret Manager API: enabled and accessible
- Starting production revision: `declarative-00102-5l7`
- Final production revision: `declarative-gemini-rotation`

The local gcloud default project pointed elsewhere, so it was not changed or relied on. Every read and mutation pinned the approved project and region explicitly.

### Secret Manager state

| Secret | Enabled numeric versions | Final production reference | Credential state |
| --- | --- | --- | --- |
| `declarative-gemini-api-key` | `1`, `2` | `2` | Version `2` is the verified replacement; version `1` remains active pending revocation. |
| `declarative-upstash-redis-rest-url` | `1` | `1` | Active. |
| `declarative-upstash-redis-rest-token` | `1` | `1` | Original default token remains active pending a separately safe overlap path. |

The three version `1` values were transferred from the literal environment variables on `declarative-00102-5l7` through direct non-printing pipelines. No temporary secret material was created for that transfer. Gemini version `2` was transferred through an owner-only temporary location; the material was securely removed and cleanup was validated. All three secrets grant `roles/secretmanager.secretAccessor` only to the runtime service account listed above.

Metadata inspection confirms that `declarative-gemini-rotation` contains no literal field for the three credential variables and pins these exact references:

- `GEMINI_API_KEY=declarative-gemini-api-key:2`
- `UPSTASH_REDIS_REST_URL=declarative-upstash-redis-rest-url:1`
- `UPSTASH_REDIS_REST_TOKEN=declarative-upstash-redis-rest-token:1`

No environment-variable secret reference uses `latest`.

### Revision and behavior evidence

`declarative-secret-baseline` was created at `2026-08-13T15:23:54.059635Z`, tagged `secret-baseline`, and kept at zero traffic while it was tested. It used secret version `1` for all three credentials. Its tagged checks passed:

- Root returned HTTP 200.
- A challenge was issued and rejected when reused.
- Initial translation returned 3 non-empty suggestions.
- More Ideas returned 3 non-empty suggestions distinct from supplied history.
- `shorter`, `longer`, `warmer`, `more_straightforward`, and `more_playful` each returned exactly 2 deduplicated suggestions distinct from the source.
- Interest Based without an interest returned HTTP 400 before challenge verification or a model call.
- A bounded candidate-only variation burst returned the expected calm HTTP 429 on request 4 after 3 successes.

Allowlisted structured logs for this revision contained 10 Gemini usage rows across `translate`, `moreIdeas`, and `variation`. Every row identified `gemini-2.5-flash`; no row reported positive thought tokens; and every token total equaled prompt plus candidate tokens. The deployed source pins `thinkingBudget: 0`.

`declarative-gemini-rotation` was created at `2026-08-13T15:34:19.488611Z`, tagged `gemini-rotation`, and kept at zero traffic while the replacement Gemini credential was tested. Its complete tagged suite passed with 4 initial suggestions, 4 distinct More Ideas suggestions, exactly 2 deduplicated suggestions for every variation direction, the one-time challenge and missing-interest guards, and the calm request-4 HTTP 429. Its allowlisted logs contained 22 usage rows across all three modes, all on `gemini-2.5-flash`, with no positive thought-token rows and exact zero-thought token accounting.

The runtime logger does not emit an explicit `thinking_budget` field. The zero-thinking claim therefore combines exact deployed-source inspection (`thinkingBudget: 0`) with the allowlisted runtime token accounting above; no log evidence was invented.

### Traffic exercise and custom-domain checks

| UTC window | Operation | Verified result |
| --- | --- | --- |
| `2026-08-13T15:30:05Z`–`15:30:15Z` | Promote `declarative-secret-baseline` | 100% traffic; custom-domain root, challenge, and 3-suggestion translation passed. |
| `2026-08-13T15:30:28Z`–`15:30:38Z` | Roll back to `declarative-00102-5l7` | 100% traffic; custom-domain root, challenge, and 4-suggestion translation passed. |
| `2026-08-13T15:30:47Z`–`15:30:59Z` | Restore `declarative-secret-baseline` | 100% traffic; custom-domain root, challenge, and 4-suggestion translation passed. |
| `2026-08-13T15:38:12Z`–`15:38:23Z` | Promote `declarative-gemini-rotation` | 100% traffic; custom-domain root, challenge, and 3-suggestion translation passed. |

The prior revisions remain available. No revision, Secret Manager secret, or historical secret version was deleted.

### Gemini credential states

- Replacement: `projects/1083695383503/locations/global/keys/5a8613d5-4ea3-4be1-b4e2-a0b2cee0d082` (`Declarative Gemini rollback 2026-08-13 v2`) is active, restricted to `generativelanguage.googleapis.com`, stored as secret version `2`, verified on the tagged revision, and serving production.
- Previous: `projects/1083695383503/locations/global/keys/cef8e82b-b048-46b8-af88-5a417fbe8530` (`Declarative Gemini API2`) is active as secret version `1` and pending revocation. Revocation was not requested or performed.
- Deleted throwaway: `projects/1083695383503/locations/global/keys/41fe1ca9-6f89-4848-bd10-8f40cec39daa` was created at `2026-08-13T15:31:28.928357Z`. This newly created valid-but-never-used key was exposed to internal tool output and immediately invalidated by deletion, recorded complete at `2026-08-13T15:31:59.782776Z`. It was never stored, deployed, or used; no production or currently active credential was exposed.

### Upstash overlap conclusion

The live database accepts `ACL LIST`, confirming ACL capability and the possibility of separate ACL REST tokens in principle. The intended replacement policy was limited to `SET`, `EXISTS`, and `DEL` on `declarative:challenge:*`.

Three isolated attempts to create that user failed safely when the live REST control path rejected the password assignment. Each partial user was deleted, final read-only inspection confirmed the user is absent, and no Upstash replacement token or secret version was created. The default database password was never reset. Production `/api/challenge` continued to pass after the attempts.

Because there is no authenticated Upstash management CLI or management API credential in this environment, a safe overlap could not be proven without expanding to an interactive provider workflow. Upstash token version `1` therefore remains active and pending rotation/revocation; no immediate-invalidation operation was attempted. Irreversible Upstash password regeneration was not approved by Kyle and remains a separate approval-gated operation.

### Final production state and concerns

- `declarative-gemini-rotation` is Ready and receives 100% of traffic.
- `https://declarativeapp.org/` is healthy through root, challenge, and live translation behavior.
- Model, prompts, SDK, and visible application behavior were not changed.
- Concern: Upstash rotation remains pending for the reason above.
- Concern: the structured runtime schema lacks an explicit `thinking_budget` field.
- Incident: one newly created valid-but-never-used replacement Gemini key was exposed to internal tool output and immediately invalidated by deletion; no production or currently active credential was exposed.
