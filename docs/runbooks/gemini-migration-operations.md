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
export LOG_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND resource.labels.revision_name=\"$CANDIDATE_REVISION\" AND jsonPayload.event:* AND jsonPayload.config_id:*"
```

## Read-only state capture

```bash
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,status.url,status.latestReadyRevisionName,status.traffic)'
gcloud run revisions list --service "$SERVICE" --project "$PROJECT" --region "$REGION" --format='table(metadata.name,status.conditions[0].status,status.conditions[0].type)'
gcloud run revisions describe "$BASELINE_REVISION" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,metadata.labels,status.conditions)'
curl --fail --silent --show-error --location --head "https://${CUSTOM_DOMAIN}/"
```

## Tagged, zero-traffic deployment

```bash
gcloud run deploy "$SERVICE" --source "$SOURCE_DIR" --tag "$CANDIDATE_TAG" --no-traffic --project "$PROJECT" --region "$REGION"
```

After deployment, set `CANDIDATE_REVISION` and `CANDIDATE_URL` from the tagged deployment output or the traffic inspection command. Do not use `latest` for a secret reference in a deployment command.

## Traffic inspection

```bash
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.latestReadyRevisionName,status.traffic)'
gcloud run revisions describe "$CANDIDATE_REVISION" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,metadata.labels,status.conditions)'
```

## Log inspection

```bash
gcloud logging read "$LOG_FILTER" --project "$PROJECT" --freshness "$LOG_FRESHNESS" --limit "$LOG_LIMIT" --format='csv[no-heading](timestamp,jsonPayload.event,jsonPayload.outcome,jsonPayload.revision,jsonPayload.config_id,jsonPayload.model,jsonPayload.thinking_level,jsonPayload.thinking_budget,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.duration_ms,jsonPayload.prompt_token_count,jsonPayload.candidates_token_count,jsonPayload.thoughts_token_count,jsonPayload.total_token_count,jsonPayload.cached_content_token_count,jsonPayload.suggestion_count,jsonPayload.finish_reason)'
```

The filter is limited to the selected Cloud Run candidate revision and structured entries that contain both `event` and `config_id`. The CSV projection emits only timestamp, event, outcome, revision, configuration ID, model, thinking metadata, mode, variation kind, duration, token counts, suggestion count, and finish reason. Do not request, print, or retain prompts, generated text, API keys, Redis values, challenge IDs, or raw provider payloads.

## Health verification

```bash
curl --fail --silent --show-error --location "$CANDIDATE_URL/healthz"
curl --fail --silent --show-error --location "https://${CUSTOM_DOMAIN}/healthz"
```

Run the candidate URL check before any traffic promotion. The custom-domain check verifies the promoted public route after the service reports the intended traffic split.

## Promotion

```bash
gcloud run services update-traffic "$SERVICE" --to-revisions "$CANDIDATE_REVISION=100" --project "$PROJECT" --region "$REGION"
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.traffic,status.latestReadyRevisionName)'
curl --fail --silent --show-error --location "https://${CUSTOM_DOMAIN}/healthz"
```

## Rollback

```bash
gcloud run services update-traffic "$SERVICE" --to-revisions "$BASELINE_REVISION=100" --project "$PROJECT" --region "$REGION"
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(status.traffic,status.latestReadyRevisionName)'
curl --fail --silent --show-error --location "https://${CUSTOM_DOMAIN}/healthz"
```

Record the revision IDs, timestamp, traffic split, health result, and non-sensitive log result after every promotion or rollback. Do not delete historical revisions during this migration.
