# Gemini Migration Operations Runbook

This workflow preserves an immutable Gemini 2.5 Flash rollback path. Never place credential values in command arguments, terminal output, logs, documents, or deployment flags. Keep shell tracing disabled and pin the approved project and region on every provider command.

## Non-secret session variables

Set `SMOKE_TEXT` privately in the operator's environment before verification. It is required, must be non-empty, and must never be printed, recorded, or committed. This runbook intentionally provides no sample value.

```bash
export SERVICE="declarative"
export PROJECT="gen-lang-client-0598048123"
export REGION="us-west1"
export LEGACY_REVISION="declarative-00102-5l7"
export ROLLBACK_CANDIDATE_REVISION="declarative-secret-baseline"
export ROLLBACK_SUFFIX="secret-baseline"
export ROLLBACK_TAG="secret-baseline"
export CANDIDATE_REVISION="declarative-gemini-rotation"
export CANDIDATE_SUFFIX="gemini-rotation"
export CANDIDATE_TAG="gemini-rotation"
export CUSTOM_DOMAIN="declarativeapp.org"
export LOG_LIMIT="100"
export LOG_SETTLE_SECONDS="60"
unset ROLLBACK_REVISION
```

`LEGACY_REVISION` is the historical literal-credential revision and is used only to capture the immutable image and identify the already-completed one-time migration rehearsal. `ROLLBACK_CANDIDATE_REVISION` is only a proposed rollback target. Do not set `ROLLBACK_REVISION` until the proposed revision has passed the tagged zero-traffic, complete behavior, missing-interest correlation, and allowlisted model/thought gates below. After Gemini credential rotation, never roll operational traffic back to `LEGACY_REVISION`.

## Identity and permission preflight

The preflight aborts unless the authenticated caller has the exact project-, secret-, and service-level permissions needed by this workflow. It does not query or emit credential values.

```bash
set -euo pipefail
set +x

CALLER="$(gcloud config get-value account 2>/dev/null)"
[ -n "$CALLER" ] || { printf '%s\n' 'Missing authenticated gcloud account.' >&2; exit 1; }

require_permission() {
  local resource="$1"
  local permission="$2"
  local access
  access="$(gcloud policy-intelligence troubleshoot-policy iam "$resource" \
    --principal-email="$CALLER" \
    --permission="$permission" \
    --project="$PROJECT" \
    --format='value(access)')"
  [ "$access" = "GRANTED" ] || {
    printf 'Permission preflight failed: %s\n' "$permission" >&2
    exit 1
  }
}

PROJECT_RESOURCE="//cloudresourcemanager.googleapis.com/projects/${PROJECT}"
SERVICE_RESOURCE="//run.googleapis.com/projects/${PROJECT}/locations/${REGION}/services/${SERVICE}"

require_permission "$PROJECT_RESOURCE" secretmanager.secrets.create
require_permission "$SERVICE_RESOURCE" run.services.get
require_permission "$SERVICE_RESOURCE" run.services.update

gcloud services list --enabled --project "$PROJECT" \
  --filter='config.name=secretmanager.googleapis.com' \
  --format='value(config.name)' \
  | awk '$0 == "secretmanager.googleapis.com" { found=1 } END { exit(found ? 0 : 1) }'
```

## Idempotent secret containers and narrow IAM

Create only missing containers. Once each container exists, preflight version and IAM permissions against that exact secret resource.

```bash
SECRETS=(
  declarative-gemini-api-key
  declarative-upstash-redis-rest-url
  declarative-upstash-redis-rest-token
)

for secret_name in "${SECRETS[@]}"; do
  if ! gcloud secrets describe "$secret_name" --project "$PROJECT" --format='none' >/dev/null 2>&1; then
    gcloud secrets create "$secret_name" \
      --replication-policy=automatic \
      --project "$PROJECT" \
      --quiet \
      --format='none'
  fi

  secret_resource="//secretmanager.googleapis.com/projects/${PROJECT}/secrets/${secret_name}"
  require_permission "$secret_resource" secretmanager.secrets.get
  require_permission "$secret_resource" secretmanager.versions.add
  require_permission "$secret_resource" secretmanager.versions.get
  require_permission "$secret_resource" secretmanager.secrets.getIamPolicy
  require_permission "$secret_resource" secretmanager.secrets.setIamPolicy
done

RUNTIME_SA="$(gcloud run services describe "$SERVICE" \
  --project "$PROJECT" --region "$REGION" \
  --format='value(spec.template.spec.serviceAccountName)')"
[ -n "$RUNTIME_SA" ] || { printf '%s\n' 'Runtime service account was not resolved.' >&2; exit 1; }

for secret_name in "${SECRETS[@]}"; do
  gcloud secrets add-iam-policy-binding "$secret_name" \
    --project "$PROJECT" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role='roles/secretmanager.secretAccessor' \
    --condition=None \
    --quiet \
    --format='none'

  gcloud secrets get-iam-policy "$secret_name" --project "$PROJECT" --format=json \
    | jq -e --arg member "serviceAccount:${RUNTIME_SA}" '
        [.bindings[]? | select(
          .role == "roles/secretmanager.secretAccessor"
          and (.members // [] | index($member) != null)
        )] | length >= 1
      ' >/dev/null
done
```

The grants above are per secret. Do not add project-wide Secret Manager access.

## Validated literal-to-secret transfer

The transfer function writes revision metadata and one selected literal only to an owner-only temporary directory. It requires exactly one matching literal, rejects empty values or any `valueFrom` source, adds no version until validation passes, confirms the returned version is numeric and enabled, then securely removes and verifies cleanup of the temporary material. It outputs only the non-sensitive numeric version.

```bash
transfer_literal_to_secret() {
  local env_name="$1"
  local secret_name="$2"
  local transfer_dir metadata_file value_file describe_error add_error state_error
  local version_resource version state

  umask 077
  transfer_dir="$(mktemp -d "/tmp/declarative-${env_name}.XXXXXX")"
  chmod 700 "$transfer_dir"
  metadata_file="$transfer_dir/revision.json"
  value_file="$transfer_dir/value"
  describe_error="$transfer_dir/describe.err"
  add_error="$transfer_dir/add.err"
  state_error="$transfer_dir/state.err"

  cleanup_transfer() {
    if [ -d "$transfer_dir" ]; then
      find "$transfer_dir" -type f -exec chmod 600 {} +
      find "$transfer_dir" -type f -exec rm -P {} +
      rmdir "$transfer_dir"
    fi
  }

  if ! gcloud run revisions describe "$LEGACY_REVISION" \
    --project "$PROJECT" --region "$REGION" --format=json \
    >"$metadata_file" 2>"$describe_error"; then
    cleanup_transfer
    return 1
  fi
  chmod 600 "$metadata_file" "$describe_error"

  if ! jq -e --arg env_name "$env_name" '
      [.spec.containers[].env[]? | select(.name == $env_name)] as $matches
      | ($matches | length) == 1
        and ($matches[0] | has("value"))
        and (($matches[0].value | type) == "string")
        and (($matches[0].value | length) > 0)
        and ((($matches[0] | has("valueFrom"))) | not)
    ' "$metadata_file" >/dev/null; then
    cleanup_transfer
    printf 'Literal validation failed for %s.\n' "$env_name" >&2
    return 1
  fi

  jq -j --arg env_name "$env_name" '
    [.spec.containers[].env[]? | select(.name == $env_name)][0].value
  ' "$metadata_file" >"$value_file"
  chmod 600 "$value_file"
  [ -s "$value_file" ] || {
    cleanup_transfer
    printf 'Empty literal rejected for %s.\n' "$env_name" >&2
    return 1
  }

  if ! version_resource="$(gcloud secrets versions add "$secret_name" \
    --data-file="$value_file" \
    --project "$PROJECT" \
    --format='value(name)' 2>"$add_error")"; then
    chmod 600 "$add_error"
    cleanup_transfer
    return 1
  fi
  chmod 600 "$add_error"

  version="${version_resource##*/}"
  case "$version" in
    ''|*[!0-9]*)
      cleanup_transfer
      printf 'Non-numeric secret version rejected for %s.\n' "$secret_name" >&2
      return 1
      ;;
  esac

  if ! state="$(gcloud secrets versions describe "$version" \
    --secret "$secret_name" \
    --project "$PROJECT" \
    --format='value(state)' 2>"$state_error")"; then
    chmod 600 "$state_error"
    cleanup_transfer
    return 1
  fi
  chmod 600 "$state_error"
  [ "$state" = "ENABLED" ] || {
    cleanup_transfer
    printf 'Secret version is not enabled for %s.\n' "$secret_name" >&2
    return 1
  }

  cleanup_transfer
  [ ! -e "$transfer_dir" ] || {
    printf 'Temporary cleanup failed for %s.\n' "$env_name" >&2
    return 1
  }
  printf '%s\n' "$version"
}

GEMINI_SECRET_VERSION="$(transfer_literal_to_secret GEMINI_API_KEY declarative-gemini-api-key)" || exit 1
UPSTASH_URL_SECRET_VERSION="$(transfer_literal_to_secret UPSTASH_REDIS_REST_URL declarative-upstash-redis-rest-url)" || exit 1
UPSTASH_TOKEN_SECRET_VERSION="$(transfer_literal_to_secret UPSTASH_REDIS_REST_TOKEN declarative-upstash-redis-rest-token)" || exit 1
export GEMINI_SECRET_VERSION UPSTASH_URL_SECRET_VERSION UPSTASH_TOKEN_SECRET_VERSION
```

Never use `latest` for an environment-variable secret reference.

## Capture and reuse the immutable image

Do not rebuild from a working directory for this baseline workflow. Capture the exact digest-qualified image from the legacy revision and reuse it for both secret-managed revisions.

```bash
IMMUTABLE_IMAGE="$(gcloud run revisions describe "$LEGACY_REVISION" \
  --project "$PROJECT" --region "$REGION" \
  --format='value(spec.containers[0].image)')"
[[ "$IMMUTABLE_IMAGE" =~ @sha256:[0-9a-f]{64}$ ]] || {
  printf '%s\n' 'Legacy image is not digest-qualified.' >&2
  exit 1
}
```

## Deploy the proposed secret-managed rollback revision

The deterministic suffix produces `declarative-secret-baseline`. At this point it is only `ROLLBACK_CANDIDATE_REVISION`; it is not yet authorized as `ROLLBACK_REVISION`. Confirm that an existing revision with that name has the intended immutable image before reusing it; otherwise abort rather than replacing history.

```bash
if gcloud run revisions describe "$ROLLBACK_CANDIDATE_REVISION" \
  --project "$PROJECT" --region "$REGION" --format='value(metadata.name)' >/dev/null 2>&1; then
  existing_image="$(gcloud run revisions describe "$ROLLBACK_CANDIDATE_REVISION" \
    --project "$PROJECT" --region "$REGION" \
    --format='value(spec.containers[0].image)')"
  [ "$existing_image" = "$IMMUTABLE_IMAGE" ] || {
    printf '%s\n' 'Existing rollback-candidate image mismatch.' >&2
    exit 1
  }
else
  gcloud run deploy "$SERVICE" \
    --image "$IMMUTABLE_IMAGE" \
    --revision-suffix "$ROLLBACK_SUFFIX" \
    --tag "$ROLLBACK_TAG" \
    --no-traffic \
    --remove-env-vars 'GEMINI_API_KEY,UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN' \
    --set-secrets "GEMINI_API_KEY=declarative-gemini-api-key:${GEMINI_SECRET_VERSION},UPSTASH_REDIS_REST_URL=declarative-upstash-redis-rest-url:${UPSTASH_URL_SECRET_VERSION},UPSTASH_REDIS_REST_TOKEN=declarative-upstash-redis-rest-token:${UPSTASH_TOKEN_SECRET_VERSION}" \
    --project "$PROJECT" --region "$REGION" --quiet
fi

verify_revision_secret_refs() {
  local revision="$1"
  local gemini_version="$2"
  local upstash_url_version="$3"
  local upstash_token_version="$4"

  gcloud run revisions describe "$revision" \
    --project "$PROJECT" --region "$REGION" --format=json \
    | jq -e \
      --arg gemini_version "$gemini_version" \
      --arg upstash_url_version "$upstash_url_version" \
      --arg upstash_token_version "$upstash_token_version" '
      def exact_ref($env_name; $secret_name; $version):
        [.spec.containers[].env[]? | select(.name == $env_name)] as $matches
        | ($matches | length) == 1
          and ((($matches[0] | has("value"))) | not)
          and ($matches[0].valueFrom.secretKeyRef.name == $secret_name)
          and ($matches[0].valueFrom.secretKeyRef.key == $version)
          and ($matches[0].valueFrom.secretKeyRef.key | test("^[0-9]+$"));
      exact_ref("GEMINI_API_KEY"; "declarative-gemini-api-key"; $gemini_version)
      and exact_ref("UPSTASH_REDIS_REST_URL"; "declarative-upstash-redis-rest-url"; $upstash_url_version)
      and exact_ref("UPSTASH_REDIS_REST_TOKEN"; "declarative-upstash-redis-rest-token"; $upstash_token_version)
    ' >/dev/null
}

verify_revision_secret_refs \
  "$ROLLBACK_CANDIDATE_REVISION" \
  "$GEMINI_SECRET_VERSION" \
  "$UPSTASH_URL_SECRET_VERSION" \
  "$UPSTASH_TOKEN_SECRET_VERSION"
```

## Reusable zero-traffic, behavior, correlation, and log gates

Define these helpers before validating either tagged revision. They emit only URL-resolution booleans, HTTP status/count metadata, revision names, and allowlisted usage/rate-limit counts. They never emit `SMOKE_TEXT`, challenge IDs, prompts, suggestions, response error text, or raw logs.

`resolve_zero_traffic_tag` resolves exactly one tagged URL and rejects the revision if any traffic entry for it has a nonzero percentage.

```bash
resolve_zero_traffic_tag() (
  set -euo pipefail
  local revision="$1"
  local tag="$2"
  local metadata_dir service_file resolved_url

  umask 077
  metadata_dir="$(mktemp -d /tmp/declarative-tag-metadata.XXXXXX)"
  service_file="$metadata_dir/service.json"
  trap 'find "$metadata_dir" -type f -exec rm -P {} +; rmdir "$metadata_dir"' EXIT

  gcloud run services describe "$SERVICE" \
    --project "$PROJECT" --region "$REGION" --format=json >"$service_file"
  chmod 600 "$service_file"

  resolved_url="$(jq -er --arg revision "$revision" --arg tag "$tag" '
    [.status.traffic[]? | select(
      .revisionName == $revision
      and .tag == $tag
      and (.url | type == "string")
      and (.url | length > 0)
    )]
    | if length == 1 then .[0].url else error("tagged URL mismatch") end
  ' "$service_file")"

  jq -e --arg revision "$revision" '
    [.status.traffic[]? | select(.revisionName == $revision)] as $entries
    | ($entries | length) >= 1
      and ([$entries[] | select((.percent // 0) != 0)] | length) == 0
  ' "$service_file" >/dev/null

  printf '%s\n' "$resolved_url"
)
```

The core behavior verifier fetches the root, challenge issue/reuse, initial translation, distinct More Ideas, all five variation directions, and a bounded candidate-only rate-limit sequence. It does not make or claim the missing-interest no-model assertion; that is a separate correlated gate immediately below.

```bash
run_behavior_gate() {
  : "${VERIFY_BASE_URL:?Set VERIFY_BASE_URL to the resolved tag or custom domain.}"
  : "${SMOKE_TEXT:?Set a private non-empty SMOKE_TEXT value.}"
  [ -n "${SMOKE_TEXT//[[:space:]]/}" ] || {
    printf '%s\n' 'SMOKE_TEXT must contain non-whitespace text.' >&2
    return 1
  }

  node --input-type=module <<'NODE'
import assert from 'node:assert/strict';

const base = process.env.VERIFY_BASE_URL;
const smokeText = process.env.SMOKE_TEXT;
assert.equal(typeof base, 'string', 'Missing verifier URL.');
assert.ok(base.length > 0, 'Empty verifier URL.');
assert.equal(typeof smokeText, 'string', 'Missing private smoke text.');
assert.ok(smokeText.trim().length > 0, 'Empty private smoke text.');

const normalize = (value) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const validSuggestion = (item) => (
  item && typeof item.translation === 'string' && item.translation.trim().length > 0
);

async function json(response) {
  return response.json().catch(() => null);
}

async function issueChallenge() {
  const response = await fetch(`${base}/api/challenge`);
  const body = await json(response);
  assert.equal(response.status, 200, 'Challenge issue failed.');
  assert.equal(typeof body?.challengeId, 'string', 'Challenge ID missing.');
  assert.ok(body.challengeId.length > 0, 'Challenge ID empty.');
  return {status: response.status, id: body.challengeId};
}

async function translate(body, suppliedChallengeId) {
  const challenge = suppliedChallengeId ?? (await issueChallenge()).id;
  const response = await fetch(`${base}/api/translate`, {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-challenge-id': challenge},
    body: JSON.stringify(body),
  });
  return {status: response.status, body: await json(response), challenge};
}

const root = await fetch(`${base}/`, {redirect: 'follow'});
assert.equal(root.status, 200, 'Root fetch failed.');

const initialRequest = {
  mode: 'translate',
  text: smokeText,
  existingTranslations: [],
  tone: 'Default',
  interest: '',
  useFewerWords: false,
};
const initial = await translate(initialRequest);
assert.equal(initial.status, 200, 'Initial translation failed.');
assert.ok(Array.isArray(initial.body), 'Initial payload was not an array.');
assert.ok(initial.body.length === 3 || initial.body.length === 4, 'Initial count failed.');
assert.ok(initial.body.every(validSuggestion), 'Initial suggestion was empty.');

const reused = await translate(initialRequest, initial.challenge);
assert.equal(reused.status, 403, 'Challenge reuse was not rejected.');

const more = await translate({...initialRequest, mode: 'moreIdeas', existingTranslations: initial.body});
assert.equal(more.status, 200, 'More Ideas failed.');
assert.ok(Array.isArray(more.body), 'More Ideas payload was not an array.');
assert.ok(more.body.length === 3 || more.body.length === 4, 'More Ideas count failed.');
assert.ok(more.body.every(validSuggestion), 'More Ideas suggestion was empty.');
const history = new Set(initial.body.map((item) => normalize(item.translation)));
assert.ok(more.body.every((item) => !history.has(normalize(item.translation))), 'More Ideas repeated history.');

const source = initial.body[0];
const variationKinds = ['shorter', 'longer', 'warmer', 'more_straightforward', 'more_playful'];
const variationCounts = {};
for (const variationKind of variationKinds) {
  const result = await translate({
    mode: 'variation',
    text: smokeText,
    tone: 'Default',
    interest: '',
    useFewerWords: false,
    sourceTranslation: source,
    variationKind,
  });
  assert.equal(result.status, 200, `Variation failed: ${variationKind}.`);
  assert.ok(Array.isArray(result.body), `Variation payload failed: ${variationKind}.`);
  assert.equal(result.body.length, 2, `Variation count failed: ${variationKind}.`);
  assert.ok(result.body.every(validSuggestion), `Variation suggestion empty: ${variationKind}.`);
  const normalized = result.body.map((item) => normalize(item.translation));
  assert.equal(new Set(normalized).size, 2, `Variation duplicate: ${variationKind}.`);
  assert.ok(normalized.every((item) => item !== normalize(source.translation)), `Variation repeated source: ${variationKind}.`);
  variationCounts[variationKind] = result.body.length;
  await new Promise((resolve) => setTimeout(resolve, 3500));
}

await new Promise((resolve) => setTimeout(resolve, 11000));
let rateLimit = null;
for (let attempt = 1; attempt <= 4; attempt += 1) {
  const result = await translate({
    mode: 'variation',
    text: smokeText,
    tone: 'Default',
    interest: '',
    useFewerWords: false,
    sourceTranslation: source,
    variationKind: 'warmer',
  });
  if (result.status === 429) {
    assert.equal(typeof result.body?.error, 'string', 'Rate-limit message missing.');
    assert.match(result.body.error, /^A lot of versions were tried quickly\. Another try will be ready in \d+ seconds\.$/, 'Rate-limit message was not calm.');
    rateLimit = {attempt, status: result.status, calm: true};
    break;
  }
  assert.equal(result.status, 200, 'Unexpected bounded rate-limit response.');
}
assert.ok(rateLimit, 'Bounded rate limit was not observed.');

console.log(JSON.stringify({
  url_resolved: true,
  root_status: root.status,
  challenge_issue_status: 200,
  challenge_reuse_status: reused.status,
  initial_count: initial.body.length,
  more_ideas_count: more.body.length,
  more_ideas_distinct: true,
  variation_counts: variationCounts,
  variations_deduplicated: true,
  rate_limit_attempt: rateLimit.attempt,
  rate_limit_status: rateLimit.status,
  calm_rate_limit: rateLimit.calm,
}));
NODE
}
```

The missing-interest gate captures an exact UTC request window and exact revision, verifies the HTTP 400 and expected error internally, waits for structured-log ingestion, then asks only whether an allowlisted `gemini_usage_metadata` timestamp exists in that revision/window. Any row is a conservative failure. The two success booleans are emitted only after both checks pass. Run this against a zero-traffic tag whenever possible; on the custom domain, use a quiet window and rerun on any unrelated usage collision.

```bash
verify_missing_interest_no_model() (
  set -euo pipefail
  : "${VERIFY_BASE_URL:?Set VERIFY_BASE_URL.}"
  : "${VERIFY_REVISION:?Set VERIFY_REVISION.}"
  : "${SMOKE_TEXT:?Set private SMOKE_TEXT.}"

  local correlation_dir status_file usage_file log_error
  local window_start window_end usage_filter
  umask 077
  correlation_dir="$(mktemp -d /tmp/declarative-missing-interest.XXXXXX)"
  status_file="$correlation_dir/status.json"
  usage_file="$correlation_dir/usage.timestamps"
  log_error="$correlation_dir/log.err"
  trap 'find "$correlation_dir" -type f -exec rm -P {} +; rmdir "$correlation_dir"' EXIT

  window_start="$(node -e 'process.stdout.write(new Date().toISOString())')"
  VERIFY_STATUS_FILE="$status_file" node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';

const response = await fetch(`${process.env.VERIFY_BASE_URL}/api/translate`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    mode: 'translate',
    text: process.env.SMOKE_TEXT,
    existingTranslations: [],
    tone: 'Interest Based',
    interest: '',
    useFewerWords: false,
  }),
});
const body = await response.json().catch(() => null);
assert.equal(response.status, 400, 'Missing interest was not rejected.');
assert.equal(body?.error, 'Interest Based ideas need an entered interest.', 'Unexpected missing-interest result.');
writeFileSync(process.env.VERIFY_STATUS_FILE, JSON.stringify({status: response.status, rejected: true}), {mode: 0o600});
NODE
  window_end="$(node -e 'process.stdout.write(new Date().toISOString())')"

  sleep "$LOG_SETTLE_SECONDS"
  usage_filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\" AND resource.labels.revision_name=\"${VERIFY_REVISION}\" AND jsonPayload.event=\"gemini_usage_metadata\" AND timestamp>=\"${window_start}\" AND timestamp<=\"${window_end}\""
  gcloud logging read "$usage_filter" \
    --project "$PROJECT" --limit=1 --order=asc \
    --format='value(timestamp)' >"$usage_file" 2>"$log_error"
  chmod 600 "$status_file" "$usage_file" "$log_error"

  jq -e '.status == 400 and .rejected == true' "$status_file" >/dev/null
  [ ! -s "$usage_file" ] || {
    printf '%s\n' 'Missing-interest correlation found a Gemini usage event; aborting.' >&2
    return 1
  }

  jq -nc --arg revision "$VERIFY_REVISION" '{
    revision: $revision,
    missing_interest_rejected: true,
    missing_interest_model_call_absent: true
  }'
)
```

The allowlisted usage gate projects only known metadata fields into owner-only files. It requires usage in all three modes, `gemini-2.5-flash` on every row, no positive thought-token count, exact token accounting, and at least one server rate-limit event. The logger has no explicit `thinking_budget` field, so separately require the immutable deployed source attestation for `thinkingBudget: 0`; do not invent a log field.

```bash
run_allowlisted_usage_gate() (
  set -euo pipefail
  local revision="$1"
  local window_start="$2"
  local window_end="$3"
  local gate_dir usage_file rate_file usage_error rate_error usage_filter rate_filter

  umask 077
  gate_dir="$(mktemp -d /tmp/declarative-usage-gate.XXXXXX)"
  usage_file="$gate_dir/usage.json"
  rate_file="$gate_dir/rate.json"
  usage_error="$gate_dir/usage.err"
  rate_error="$gate_dir/rate.err"
  trap 'find "$gate_dir" -type f -exec rm -P {} +; rmdir "$gate_dir"' EXIT

  sleep "$LOG_SETTLE_SECONDS"
  usage_filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\" AND resource.labels.revision_name=\"${revision}\" AND jsonPayload.event=\"gemini_usage_metadata\" AND timestamp>=\"${window_start}\" AND timestamp<=\"${window_end}\""
  rate_filter="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${SERVICE}\" AND resource.labels.revision_name=\"${revision}\" AND jsonPayload.event=\"rate_limit_hit\" AND timestamp>=\"${window_start}\" AND timestamp<=\"${window_end}\""

  gcloud logging read "$usage_filter" \
    --project "$PROJECT" --limit "$LOG_LIMIT" --order=asc \
    --format='json(timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.model,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.duration_ms,jsonPayload.prompt_token_count,jsonPayload.candidates_token_count,jsonPayload.thoughts_token_count,jsonPayload.total_token_count,jsonPayload.cached_content_token_count)' \
    >"$usage_file" 2>"$usage_error"

  gcloud logging read "$rate_filter" \
    --project "$PROJECT" --limit "$LOG_LIMIT" --order=asc \
    --format='json(timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.source,jsonPayload.endpoint,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.wait_seconds,jsonPayload.window_ms,jsonPayload.max_requests_per_window)' \
    >"$rate_file" 2>"$rate_error"
  chmod 600 "$usage_file" "$rate_file" "$usage_error" "$rate_error"

  jq -e --arg revision "$revision" '
    length > 0
    and all(.[].resource.labels.revision_name == $revision)
    and all(.[].jsonPayload.event == "gemini_usage_metadata")
    and all(.[].jsonPayload.model == "gemini-2.5-flash")
    and (([.[].jsonPayload.mode] | unique) as $modes
      | (["translate", "moreIdeas", "variation"] - $modes | length) == 0)
    and all(((.[].jsonPayload.thoughts_token_count // 0) | tonumber) == 0)
    and all(
      (.[].jsonPayload.total_token_count | tonumber)
      == ((.[].jsonPayload.prompt_token_count | tonumber) + (.[].jsonPayload.candidates_token_count | tonumber))
    )
  ' "$usage_file" >/dev/null
  jq -e --arg revision "$revision" '
    length >= 1
    and all(.[].resource.labels.revision_name == $revision)
    and all(.[].jsonPayload.event == "rate_limit_hit")
  ' "$rate_file" >/dev/null

  jq -n \
    --arg revision "$revision" \
    --argjson usage_rows "$(jq 'length' "$usage_file")" \
    --argjson rate_rows "$(jq 'length' "$rate_file")" \
    --argjson modes "$(jq '[.[].jsonPayload.mode] | unique | sort' "$usage_file")" '{
      revision: $revision,
      usage_rows: $usage_rows,
      modes: $modes,
      model: "gemini-2.5-flash",
      positive_thought_rows: 0,
      token_accounting_valid: true,
      rate_limit_rows: $rate_rows
    }'
)

verify_deployed_model_and_thinking_source() {
  [ "$(rg -c "model: 'gemini-2.5-flash'" server.js)" -ge 1 ]
  [ "$(rg -c 'thinkingBudget:[[:space:]]*0' server.js)" -eq 1 ]
}

run_complete_revision_gate() {
  local revision="$1"
  local resolved_url="$2"
  local behavior_start behavior_end

  export VERIFY_REVISION="$revision"
  export VERIFY_BASE_URL="$resolved_url"
  behavior_start="$(node -e 'process.stdout.write(new Date().toISOString())')"
  run_behavior_gate
  behavior_end="$(node -e 'process.stdout.write(new Date().toISOString())')"
  verify_missing_interest_no_model
  verify_deployed_model_and_thinking_source
  run_allowlisted_usage_gate "$revision" "$behavior_start" "$behavior_end"
}
```

## Pre-traffic rollback validation and designation

Sequencing is mandatory: resolve the `secret-baseline` tagged URL, prove the proposed revision has zero traffic, verify all three numeric secret references, run the complete behavior and correlated missing-interest gates, then run the allowlisted model/thought/rate-limit gate. Only after every command passes may the revision be exported as `ROLLBACK_REVISION`. Candidate deployment and promotion both require that designation.

```bash
export ROLLBACK_CANDIDATE_URL="$(resolve_zero_traffic_tag \
  "$ROLLBACK_CANDIDATE_REVISION" "$ROLLBACK_TAG")"

verify_revision_secret_refs \
  "$ROLLBACK_CANDIDATE_REVISION" \
  "$GEMINI_SECRET_VERSION" \
  "$UPSTASH_URL_SECRET_VERSION" \
  "$UPSTASH_TOKEN_SECRET_VERSION"

run_complete_revision_gate \
  "$ROLLBACK_CANDIDATE_REVISION" \
  "$ROLLBACK_CANDIDATE_URL"

export ROLLBACK_REVISION="$ROLLBACK_CANDIDATE_REVISION"
export ROLLBACK_GATE_PASSED="true"
```

If any step fails, leave `ROLLBACK_REVISION` unset, keep public traffic unchanged, and stop. Do not deploy or promote a replacement-key candidate without a validated rollback target.

## Reproducible replacement Gemini key rotation

This procedure creates a unique display identifier, confirms no preexisting exact metadata match, launches key creation asynchronously, and discovers completion only through key-list metadata. It never waits on, describes, or retrieves a long-running operation result. Any command capable of returning credential material redirects stdout directly to an owner-only file and controls stderr separately.

On failure, the trap removes and verifies local temporary material. If exactly one newly created resource has been proven, the trap requests asynchronous deletion of only that never-deployed key, with all output contained; it never touches an old key. If exact-one discovery fails, no key is guessed or deleted: stop with the unique display identifier for a metadata-only audit. If a Secret Manager version was added before a later failure, retain that version, do not deploy it, and record it for review; the newly created key is still requested for invalidation.

```bash
create_restricted_gemini_secret_version() (
  set -euo pipefail
  set +x
  umask 077

  local rotation_dir metadata_file key_file
  local create_stdout create_stderr list_stderr key_stderr secret_stderr state_stderr
  local abort_stdout abort_stderr
  local rotation_id rotation_display_name match_count new_key_resource=""
  local version_resource secret_version state rotation_complete="false"

  rotation_dir="$(mktemp -d /tmp/declarative-gemini-rotation.XXXXXX)"
  chmod 700 "$rotation_dir"
  metadata_file="$rotation_dir/keys.json"
  key_file="$rotation_dir/key"
  create_stdout="$rotation_dir/create.out"
  create_stderr="$rotation_dir/create.err"
  list_stderr="$rotation_dir/list.err"
  key_stderr="$rotation_dir/key.err"
  secret_stderr="$rotation_dir/secret.err"
  state_stderr="$rotation_dir/state.err"
  abort_stdout="$rotation_dir/abort.out"
  abort_stderr="$rotation_dir/abort.err"

  cleanup_rotation() {
    local status="$?"
    trap - EXIT HUP INT TERM
    set +e
    if [ "$rotation_complete" != "true" ] \
      && [[ "$new_key_resource" =~ ^projects/[0-9]+/locations/global/keys/[A-Za-z0-9-]+$ ]]; then
      gcloud services api-keys delete "$new_key_resource" \
        --project "$PROJECT" --async --quiet --format=none \
        >"$abort_stdout" 2>"$abort_stderr" || true
    fi
    if [ -d "$rotation_dir" ]; then
      find "$rotation_dir" -type f -exec chmod 600 {} +
      find "$rotation_dir" -type f -exec rm -P {} +
      rmdir "$rotation_dir" || status=1
    fi
    [ ! -e "$rotation_dir" ] || status=1
    exit "$status"
  }
  trap cleanup_rotation EXIT HUP INT TERM

  rotation_id="$(date -u +%Y%m%dT%H%M%SZ)-$(printf '%05d%05d' "$RANDOM" "$RANDOM")"
  rotation_display_name="Declarative Gemini rotation ${rotation_id}"

  gcloud services api-keys list \
    --project "$PROJECT" --format=json \
    >"$metadata_file" 2>"$list_stderr"
  chmod 600 "$metadata_file" "$list_stderr"
  match_count="$(jq --arg display "$rotation_display_name" '[.[] | select(.displayName == $display)] | length' "$metadata_file")"
  [ "$match_count" -eq 0 ] || {
    printf '%s\n' 'Unique display-name preflight failed.' >&2
    return 1
  }

  gcloud services api-keys create \
    --display-name="$rotation_display_name" \
    --api-target='service=generativelanguage.googleapis.com' \
    --project "$PROJECT" --async --format='value(name)' \
    >"$create_stdout" 2>"$create_stderr"
  chmod 600 "$create_stdout" "$create_stderr"

  match_count=0
  for _attempt in $(seq 1 30); do
    gcloud services api-keys list \
      --project "$PROJECT" --format=json \
      >"$metadata_file" 2>"$list_stderr"
    match_count="$(jq --arg display "$rotation_display_name" '[.[] | select(.displayName == $display)] | length' "$metadata_file")"
    [ "$match_count" -le 1 ] || {
      printf '%s\n' 'Replacement-key discovery was not unique; no key will be guessed or deleted.' >&2
      return 1
    }
    [ "$match_count" -eq 1 ] && break
    sleep 2
  done
  [ "$match_count" -eq 1 ] || {
    printf '%s\n' 'Replacement-key metadata did not converge to exactly one match.' >&2
    return 1
  }

  new_key_resource="$(jq -er --arg display "$rotation_display_name" '
    [.[] | select(.displayName == $display)]
    | if length == 1 then .[0].name else error("exact-one discovery failed") end
  ' "$metadata_file")"
  [[ "$new_key_resource" =~ ^projects/[0-9]+/locations/global/keys/[A-Za-z0-9-]+$ ]] || {
    printf '%s\n' 'Replacement-key resource metadata was invalid.' >&2
    return 1
  }

  jq -e --arg display "$rotation_display_name" '
    length >= 1
    and ([.[] | select(.displayName == $display)] | length == 1)
    and ([.[] | select(.displayName == $display)][0].restrictions.apiTargets // [] | length == 1)
    and ([.[] | select(.displayName == $display)][0].restrictions.apiTargets[0].service == "generativelanguage.googleapis.com")
  ' "$metadata_file" >/dev/null || {
    printf '%s\n' 'Replacement-key API restriction verification failed.' >&2
    return 1
  }

  gcloud services api-keys get-key-string "$new_key_resource" \
    --project "$PROJECT" --format='value(keyString)' \
    >"$key_file" 2>"$key_stderr"
  chmod 600 "$key_file" "$key_stderr"
  [ -s "$key_file" ] \
    && grep -q '[^[:space:]]' "$key_file" \
    && [ "$(awk 'END { print NR }' "$key_file")" -eq 1 ] || {
      printf '%s\n' 'Owner-only credential retrieval validation failed.' >&2
      return 1
    }

  version_resource="$(gcloud secrets versions add declarative-gemini-api-key \
    --project "$PROJECT" --data-file="$key_file" \
    --format='value(name)' 2>"$secret_stderr")"
  chmod 600 "$secret_stderr"
  secret_version="${version_resource##*/}"
  case "$secret_version" in
    ''|*[!0-9]*)
      printf '%s\n' 'Replacement secret version was not numeric.' >&2
      return 1
      ;;
  esac

  state="$(gcloud secrets versions describe "$secret_version" \
    --secret declarative-gemini-api-key \
    --project "$PROJECT" --format='value(state)' 2>"$state_stderr")"
  chmod 600 "$state_stderr"
  [ "$state" = "ENABLED" ] || {
    printf '%s\n' 'Replacement secret version was not enabled.' >&2
    return 1
  }

  find "$rotation_dir" -type f -exec chmod 600 {} +
  find "$rotation_dir" -type f -exec rm -P {} +
  rmdir "$rotation_dir"
  [ ! -e "$rotation_dir" ] || {
    printf '%s\n' 'Replacement-key temporary cleanup failed.' >&2
    return 1
  }
  rotation_complete="true"
  trap - EXIT HUP INT TERM
  printf '%s\n' "$secret_version"
)

GEMINI_REPLACEMENT_SECRET_VERSION="$(create_restricted_gemini_secret_version)" || exit 1
export GEMINI_REPLACEMENT_SECRET_VERSION
```

The synchronous operation-result path is prohibited even with a field projection: do not run API-key `operations describe`, `operations wait`, or any equivalent wait-for-result command. Do not print the temporary files, key string, or a hash of it.

## Deploy and gate the rotated Gemini candidate

The candidate may be deployed only after the proposed rollback has become `ROLLBACK_REVISION`. It keeps that revision's exact image and Upstash versions, pins the newly enabled numeric Gemini version, and starts at zero traffic.

```bash
[ "${ROLLBACK_GATE_PASSED:-}" = "true" ] || {
  printf '%s\n' 'Validated rollback gate is required before candidate deployment.' >&2
  exit 1
}
: "${ROLLBACK_REVISION:?ROLLBACK_REVISION must be designated after its full tagged gate.}"
: "${GEMINI_REPLACEMENT_SECRET_VERSION:?Set the enabled numeric replacement version.}"
case "$GEMINI_REPLACEMENT_SECRET_VERSION" in
  ''|*[!0-9]*) printf '%s\n' 'Replacement Gemini version must be numeric.' >&2; exit 1 ;;
esac

ROLLBACK_IMAGE="$(gcloud run revisions describe "$ROLLBACK_REVISION" \
  --project "$PROJECT" --region "$REGION" \
  --format='value(spec.containers[0].image)')"
[ "$ROLLBACK_IMAGE" = "$IMMUTABLE_IMAGE" ] || {
  printf '%s\n' 'Rollback image drift detected.' >&2
  exit 1
}

gcloud run deploy "$SERVICE" \
  --image "$ROLLBACK_IMAGE" \
  --revision-suffix "$CANDIDATE_SUFFIX" \
  --tag "$CANDIDATE_TAG" \
  --no-traffic \
  --update-secrets "GEMINI_API_KEY=declarative-gemini-api-key:${GEMINI_REPLACEMENT_SECRET_VERSION}" \
  --project "$PROJECT" --region "$REGION" --quiet

export CANDIDATE_URL="$(resolve_zero_traffic_tag \
  "$CANDIDATE_REVISION" "$CANDIDATE_TAG")"
verify_revision_secret_refs \
  "$CANDIDATE_REVISION" \
  "$GEMINI_REPLACEMENT_SECRET_VERSION" \
  "$UPSTASH_URL_SECRET_VERSION" \
  "$UPSTASH_TOKEN_SECRET_VERSION"
run_complete_revision_gate "$CANDIDATE_REVISION" "$CANDIDATE_URL"
export CANDIDATE_GATE_PASSED="true"
```

If any candidate gate fails, leave it tagged at zero traffic and stop. A passing candidate does not weaken the requirement that the already validated secret-managed rollback remain available.

## Promotion, rollback, and restoration

Promotion is allowed only when both tagged zero-traffic gates passed. After each traffic change, verify the exact 100% revision from service metadata and rerun the same complete verifier against the custom domain. This fetches the custom-domain root and verifies challenge, translation, rate limiting, correlated missing-interest absence, and allowlisted model/thought evidence for the exact live revision. Wait for prior request windows to clear; a correlation collision is a conservative failure and must be rerun in a quiet window.

```bash
assert_full_traffic() {
  local expected_revision="$1"
  gcloud run services describe "$SERVICE" \
    --project "$PROJECT" --region "$REGION" --format=json \
    | jq -e --arg revision "$expected_revision" '
        [.status.traffic[]? | select((.percent // 0) > 0)] as $active
        | ($active | length) == 1
          and ($active[0].revisionName == $revision)
          and ($active[0].percent == 100)
      ' >/dev/null
}

[ "${ROLLBACK_GATE_PASSED:-}" = "true" ]
[ "${CANDIDATE_GATE_PASSED:-}" = "true" ]

gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${CANDIDATE_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$CANDIDATE_REVISION"
run_complete_revision_gate "$CANDIDATE_REVISION" "https://${CUSTOM_DOMAIN}"

# Operational rollback after Gemini rotation: always use the validated secret-managed rollback.
gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${ROLLBACK_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$ROLLBACK_REVISION"
run_complete_revision_gate "$ROLLBACK_REVISION" "https://${CUSTOM_DOMAIN}"

# Restore the verified rotated candidate.
gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${CANDIDATE_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$CANDIDATE_REVISION"
run_complete_revision_gate "$CANDIDATE_REVISION" "https://${CUSTOM_DOMAIN}"
```

The completed one-time legacy rollback rehearsal is evidence in the Phase 1 baseline; do not rerun it after credential rotation. Keep both historical revisions available and do not delete them. After rotation, `ROLLBACK_REVISION` remains the validated secret-managed baseline, never `LEGACY_REVISION`.

## Upstash overlap safety

Never reset or regenerate the database password as part of overlap testing. First use non-sensitive `ACL LIST` and `ACL GETUSER` checks while keeping the existing URL/token in memory. A replacement ACL user must be limited to `SET`, `EXISTS`, and `DEL` on `declarative:challenge:*`; test allowed operations and denied ACL access before piping its REST token into Secret Manager.

If any ACL policy or password operation is rejected, remove the partial user, verify it is absent, verify production challenge behavior, and leave rotation pending. Irreversible Upstash password regeneration was not approved by Kyle and remains a separate approval-gated operation. Do not improvise with an interactive console or password reset.
