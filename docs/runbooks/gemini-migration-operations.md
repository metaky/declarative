# Gemini Migration Operations Runbook

Use this runbook only after setting the non-secret variables below. Never place credential values in shell commands, environment output, logs, documents, or deployment flags.

```bash
export SERVICE="declarative"
export PROJECT="gen-lang-client-0598048123"
export REGION="us-west1"
export BASELINE_REVISION="declarative-00102-5l7"
export CANDIDATE_REVISION="replace-after-tagged-deploy"
export CANDIDATE_TAG="gemini-candidate"
export CANDIDATE_URL="replace-with-tagged-revision-url"
export CUSTOM_DOMAIN="declarativeapp.org"
export SOURCE_DIR="."
export LOG_LIMIT="100"
export LOG_FRESHNESS="1h"
export LOG_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND resource.labels.revision_name=\"$CANDIDATE_REVISION\" AND jsonPayload.event=\"gemini_usage_metadata\""
export RATE_LIMIT_LOG_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND resource.labels.revision_name=\"$CANDIDATE_REVISION\" AND jsonPayload.event=\"rate_limit_hit\""
```

Keep shell tracing disabled. Every command must pin `--project "$PROJECT"` and, for Cloud Run, `--region "$REGION"`; do not rely on shared gcloud defaults.

## Read-only state capture

```bash
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,status.url,status.latestReadyRevisionName,status.traffic)'
gcloud run revisions list --service "$SERVICE" --project "$PROJECT" --region "$REGION" --format='table(metadata.name,status.conditions[0].status,status.conditions[0].type)'
gcloud run revisions describe "$BASELINE_REVISION" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,metadata.labels,status.conditions)'
curl --fail --silent --show-error --location --head "https://${CUSTOM_DOMAIN}/"
```

Before mutation, also confirm the authenticated account, Secret Manager API, runtime service account, and credential source types. Project a source type only; never emit an environment value.

```bash
gcloud config get-value account
gcloud services list --enabled --project "$PROJECT" --filter='config.name=secretmanager.googleapis.com' --format='value(config.name)'
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(spec.template.spec.serviceAccountName)'
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format=json \
  | jq -r '[.spec.template.spec.containers[].env[]? | select(.name == "GEMINI_API_KEY" or .name == "UPSTASH_REDIS_REST_URL" or .name == "UPSTASH_REDIS_REST_TOKEN") | {name,source:(if has("valueFrom") then "secret-reference" elif has("value") then "literal" else "unset" end)}]'
```

## Literal-to-secret transfer

Create missing containers, then transfer each literal directly from the selected source revision into Secret Manager. The examples deliberately keep values inside a pipeline. Never add an inspection command between the two provider commands.

```bash
set +x
set -o pipefail

gcloud run revisions describe "$BASELINE_REVISION" --project "$PROJECT" --region "$REGION" --format=json \
  | jq -j '.spec.containers[].env[] | select(.name == "GEMINI_API_KEY") | .value' \
  | gcloud secrets versions add declarative-gemini-api-key --data-file=- --project "$PROJECT" --format='value(name)'

gcloud run revisions describe "$BASELINE_REVISION" --project "$PROJECT" --region "$REGION" --format=json \
  | jq -j '.spec.containers[].env[] | select(.name == "UPSTASH_REDIS_REST_URL") | .value' \
  | gcloud secrets versions add declarative-upstash-redis-rest-url --data-file=- --project "$PROJECT" --format='value(name)'

gcloud run revisions describe "$BASELINE_REVISION" --project "$PROJECT" --region "$REGION" --format=json \
  | jq -j '.spec.containers[].env[] | select(.name == "UPSTASH_REDIS_REST_TOKEN") | .value' \
  | gcloud secrets versions add declarative-upstash-redis-rest-token --data-file=- --project "$PROJECT" --format='value(name)'
```

Record the returned numeric versions. Grant `roles/secretmanager.secretAccessor` separately on each secret to the service's runtime service account. Do not grant project-wide secret access.

## Tagged, zero-traffic deployment

When replacing literals with secret references, Cloud Run requires removal of the literal variables in the same deploy operation. Pin numeric versions explicitly:

```bash
gcloud run deploy "$SERVICE" --source "$SOURCE_DIR" --tag "$CANDIDATE_TAG" --no-traffic \
  --remove-env-vars 'GEMINI_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN' \
  --set-secrets 'GEMINI_API_KEY=declarative-gemini-api-key:NUMERIC_VERSION,UPSTASH_REDIS_REST_URL=declarative-upstash-redis-rest-url:NUMERIC_VERSION,UPSTASH_REDIS_REST_TOKEN=declarative-upstash-redis-rest-token:NUMERIC_VERSION' \
  --project "$PROJECT" --region "$REGION"
```

After deployment, set `CANDIDATE_REVISION` and `CANDIDATE_URL` from the tagged deployment output or the traffic inspection command. Do not use `latest` for a secret reference in a deployment command.

## Traffic inspection

```bash
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.latestReadyRevisionName,status.traffic)'
gcloud run revisions describe "$CANDIDATE_REVISION" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,metadata.labels,status.conditions)'
```

## Log inspection

```bash
gcloud logging read "$LOG_FILTER" --project "$PROJECT" --freshness "$LOG_FRESHNESS" --limit "$LOG_LIMIT" --format='csv[no-heading](timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.model,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.duration_ms,jsonPayload.prompt_token_count,jsonPayload.candidates_token_count,jsonPayload.thoughts_token_count,jsonPayload.total_token_count,jsonPayload.cached_content_token_count)'
gcloud logging read "$RATE_LIMIT_LOG_FILTER" --project "$PROJECT" --freshness "$LOG_FRESHNESS" --limit "$LOG_LIMIT" --format='csv[no-heading](timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.source,jsonPayload.endpoint,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.wait_seconds,jsonPayload.window_ms,jsonPayload.max_requests_per_window)'
```

The filters are limited to the selected candidate and structured events. The projection emits only revision, event, model/mode, timing, token counts, and rate-limit metadata. Do not request, print, or retain prompts, generated text, API keys, Redis values, challenge IDs, or raw provider payloads.

The current logger does not emit `thinking_budget`. Confirm `thinkingBudget: 0` in the exact deployed source and verify that every usage row has no positive thought count and that `total_token_count = prompt_token_count + candidates_token_count`. Record the logger limitation; do not manufacture an explicit field.

## Root, challenge, and translation verification

There is no `/healthz` endpoint in this phase. Check the root without printing its body, then keep the one-time challenge and generated suggestions in memory. Emit only statuses, counts, and boolean assertions.

```bash
curl --fail --silent --show-error --location --head "$CANDIDATE_URL/"

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
const base = process.env.CANDIDATE_URL;
const challengeResponse = await fetch(`${base}/api/challenge`);
const challenge = await challengeResponse.json();
assert.equal(challengeResponse.status, 200);
assert.equal(typeof challenge.challengeId, 'string');
const response = await fetch(`${base}/api/translate`, {
  method: 'POST',
  headers: {'content-type': 'application/json', 'x-challenge-id': challenge.challengeId},
  body: JSON.stringify({mode: 'translate', text: 'Please put your shoes by the door.', existingTranslations: [], tone: 'Default', interest: '', useFewerWords: false}),
});
const payload = await response.json();
assert.equal(response.status, 200);
assert.ok(Array.isArray(payload) && (payload.length === 3 || payload.length === 4));
assert.ok(payload.every((item) => typeof item?.translation === 'string' && item.translation.trim().length > 0));
console.log(JSON.stringify({root: 200, challenge: 200, translation: 200, suggestion_count: payload.length, non_empty: true}));
NODE
```

Before promotion, also verify More Ideas distinctness, exactly two deduplicated results for every variation direction, pre-model rejection of Interest Based without an interest, and a bounded candidate-only calm 429. Do not print response text. Confirm from traffic metadata that the tagged candidate has no percentage before running these checks.

## Promotion

```bash
gcloud run services update-traffic "$SERVICE" --to-revisions "$CANDIDATE_REVISION=100" --project "$PROJECT" --region "$REGION"
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.traffic,status.latestReadyRevisionName)'
curl --fail --silent --show-error --location --head "https://${CUSTOM_DOMAIN}/"
```

Repeat the in-memory challenge and translation check against `https://${CUSTOM_DOMAIN}` after promotion.

## Rollback

```bash
gcloud run services update-traffic "$SERVICE" --to-revisions "$BASELINE_REVISION=100" --project "$PROJECT" --region "$REGION"
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.traffic,status.latestReadyRevisionName)'
curl --fail --silent --show-error --location --head "https://${CUSTOM_DOMAIN}/"
```

Repeat the in-memory challenge and translation check after rollback and after restoration. Record revision IDs, UTC timestamps, traffic splits, root/challenge/translation results, and non-sensitive log results. Do not delete historical revisions.

## Replacement Gemini key safety

Create replacement API keys asynchronously and discover the completed key by metadata. Do not synchronously wait on or describe an API-key operation: provider operation output can include `keyString` even when a field projection was requested.

```bash
gcloud services api-keys create --project "$PROJECT" \
  --display-name='Declarative Gemini rollback YYYY-MM-DD' \
  --api-target='service=generativelanguage.googleapis.com' \
  --async --format='value(name)'

gcloud services api-keys list --project "$PROJECT" \
  --filter='displayName="Declarative Gemini rollback YYYY-MM-DD"' \
  --format='value(name)'
```

For key-string retrieval, redirect stdout into an owner-only file and stderr into a separate owner-only file. Validate the result, pipe only the parsed key into Secret Manager, then securely remove and verify removal of the temporary directory. Never display either file. Pin the resulting numeric version on a zero-traffic tagged revision and run the complete behavior/log gate before promotion.

## Upstash overlap safety

Never reset the database password as part of overlap testing. First issue non-sensitive `ACL LIST`/`ACL GETUSER` checks while keeping the current URL and token in memory. A replacement ACL user must be limited to `SET`, `EXISTS`, and `DEL` on `declarative:challenge:*`; test allowed operations and denied ACL access before piping its REST token into Secret Manager.

If any ACL policy or password operation is rejected, remove the partial user, verify it is absent, verify production `/api/challenge`, and leave rotation pending. Do not improvise with an interactive console or a password reset without separate approval.
