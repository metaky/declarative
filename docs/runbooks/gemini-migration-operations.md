# Gemini Migration Operations Runbook

This workflow preserves an immutable Gemini 2.5 Flash rollback path. Never place credential values in command arguments, terminal output, logs, documents, or deployment flags. Keep shell tracing disabled and pin the approved project and region on every provider command.

## Non-secret session variables

Set `SMOKE_TEXT` privately in the operator's environment before verification. It is required, must be non-empty, and must never be printed, recorded, or committed. This runbook intentionally provides no sample value.

```bash
export SERVICE="declarative"
export PROJECT="gen-lang-client-0598048123"
export REGION="us-west1"
export LEGACY_REVISION="declarative-00102-5l7"
export ROLLBACK_REVISION="declarative-secret-baseline"
export ROLLBACK_SUFFIX="secret-baseline"
export ROLLBACK_TAG="secret-baseline"
export CANDIDATE_REVISION="declarative-gemini-rotation"
export CANDIDATE_SUFFIX="gemini-rotation"
export CANDIDATE_TAG="gemini-rotation"
export CUSTOM_DOMAIN="declarativeapp.org"
export LOG_LIMIT="100"
export LOG_FRESHNESS="1h"
export LOG_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND resource.labels.revision_name=\"$CANDIDATE_REVISION\" AND jsonPayload.event=\"gemini_usage_metadata\""
export RATE_LIMIT_LOG_FILTER="resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"$SERVICE\" AND resource.labels.revision_name=\"$CANDIDATE_REVISION\" AND jsonPayload.event=\"rate_limit_hit\""
```

`LEGACY_REVISION` is the historical literal-credential revision and is used only to capture the immutable image and identify the already-completed one-time migration rehearsal. `ROLLBACK_REVISION` is the secret-managed Gemini 2.5 Flash rollback target. After Gemini credential rotation, never roll operational traffic back to `LEGACY_REVISION`.

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

## Deploy the secret-managed rollback revision

The deterministic suffix produces `declarative-secret-baseline`. Confirm that an existing revision with that name has the intended immutable image before reusing it; otherwise abort rather than replacing history.

```bash
if gcloud run revisions describe "$ROLLBACK_REVISION" \
  --project "$PROJECT" --region "$REGION" --format='value(metadata.name)' >/dev/null 2>&1; then
  existing_image="$(gcloud run revisions describe "$ROLLBACK_REVISION" \
    --project "$PROJECT" --region "$REGION" \
    --format='value(spec.containers[0].image)')"
  [ "$existing_image" = "$IMMUTABLE_IMAGE" ] || {
    printf '%s\n' 'Existing rollback revision image mismatch.' >&2
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
  "$ROLLBACK_REVISION" \
  "$GEMINI_SECRET_VERSION" \
  "$UPSTASH_URL_SECRET_VERSION" \
  "$UPSTASH_TOKEN_SECRET_VERSION"
```

## Deploy a rotated Gemini candidate from the same image

Set `GEMINI_REPLACEMENT_SECRET_VERSION` to the verified enabled numeric version created by the separately safe key-rotation procedure. The candidate keeps the rollback revision's exact image and Upstash versions.

```bash
: "${GEMINI_REPLACEMENT_SECRET_VERSION:?Set the enabled numeric replacement version privately.}"
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
```

## Candidate URL, zero-traffic, and secret-reference metadata gate

Resolve the tagged URL from service metadata, prove the candidate has zero traffic, and verify all three variables are exact numeric Secret Manager references with no literal field.

```bash
SERVICE_JSON="$(mktemp /tmp/declarative-service.XXXXXX)"
chmod 600 "$SERVICE_JSON"
trap 'rm -P "$SERVICE_JSON"' EXIT

gcloud run services describe "$SERVICE" \
  --project "$PROJECT" --region "$REGION" --format=json >"$SERVICE_JSON"

export CANDIDATE_URL="$(jq -er --arg revision "$CANDIDATE_REVISION" --arg tag "$CANDIDATE_TAG" '
  [.status.traffic[]? | select(.revisionName == $revision and .tag == $tag and (.url | type == "string") and (.url | length > 0))]
  | if length == 1 then .[0].url else error("candidate URL mismatch") end
' "$SERVICE_JSON")"

jq -e --arg revision "$CANDIDATE_REVISION" '
  [.status.traffic[]? | select(.revisionName == $revision)] as $entries
  | ($entries | length) >= 1
    and ([$entries[] | select((.percent // 0) != 0)] | length) == 0
' "$SERVICE_JSON" >/dev/null

verify_revision_secret_refs \
  "$CANDIDATE_REVISION" \
  "$GEMINI_REPLACEMENT_SECRET_VERSION" \
  "$UPSTASH_URL_SECRET_VERSION" \
  "$UPSTASH_TOKEN_SECRET_VERSION"

rm -P "$SERVICE_JSON"
trap - EXIT
[ ! -e "$SERVICE_JSON" ]
```

## Complete bounded behavior verifier

This verifier fetches the root and emits only status codes, counts, and booleans. It keeps `SMOKE_TEXT`, challenge IDs, prompts, and suggestions in memory. Wait for prior rate-limit windows to clear before each complete run.

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

const missingInterest = await fetch(`${base}/api/translate`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({...initialRequest, tone: 'Interest Based', interest: ''}),
});
const missingInterestBody = await json(missingInterest);
assert.equal(missingInterest.status, 400, 'Missing interest was not rejected.');
assert.equal(missingInterestBody?.error, 'Interest Based ideas need an entered interest.', 'Unexpected missing-interest result.');

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
  missing_interest_status: missingInterest.status,
  missing_interest_pre_model: true,
  rate_limit_attempt: rateLimit.attempt,
  rate_limit_status: rateLimit.status,
  calm_rate_limit: rateLimit.calm,
}));
NODE
}

export VERIFY_BASE_URL="$CANDIDATE_URL"
run_behavior_gate
```

## Allowlisted structured-log verification

Read only structured entries for the exact candidate and project only allowlisted metadata fields. Never use an unfiltered or raw log format.

```bash
gcloud logging read "$LOG_FILTER" \
  --project "$PROJECT" --freshness "$LOG_FRESHNESS" --limit "$LOG_LIMIT" \
  --format='csv[no-heading](timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.model,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.duration_ms,jsonPayload.prompt_token_count,jsonPayload.candidates_token_count,jsonPayload.thoughts_token_count,jsonPayload.total_token_count,jsonPayload.cached_content_token_count)'

gcloud logging read "$RATE_LIMIT_LOG_FILTER" \
  --project "$PROJECT" --freshness "$LOG_FRESHNESS" --limit "$LOG_LIMIT" \
  --format='csv[no-heading](timestamp,resource.labels.revision_name,jsonPayload.event,jsonPayload.source,jsonPayload.endpoint,jsonPayload.mode,jsonPayload.variation_kind,jsonPayload.wait_seconds,jsonPayload.window_ms,jsonPayload.max_requests_per_window)'
```

The current logger does not emit `thinking_budget`. Confirm `thinkingBudget: 0` in the exact deployed source and verify every usage row has no positive thought count and satisfies `total_token_count = prompt_token_count + candidates_token_count`. Record the schema limitation; do not invent a field.

## Promotion, rollback, and restoration

Run the complete behavior verifier against the tagged candidate before promotion. After each traffic change, verify the exact 100% revision from service metadata, fetch the custom domain root, and rerun the same verifier against the custom domain after the prior request windows clear.

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

gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${CANDIDATE_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$CANDIDATE_REVISION"
export VERIFY_BASE_URL="https://${CUSTOM_DOMAIN}"
run_behavior_gate

# Operational rollback after Gemini rotation: always use the secret-managed baseline.
gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${ROLLBACK_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$ROLLBACK_REVISION"
export VERIFY_BASE_URL="https://${CUSTOM_DOMAIN}"
run_behavior_gate

# Restore the verified rotated candidate.
gcloud run services update-traffic "$SERVICE" \
  --to-revisions "${CANDIDATE_REVISION}=100" \
  --project "$PROJECT" --region "$REGION" --quiet
assert_full_traffic "$CANDIDATE_REVISION"
export VERIFY_BASE_URL="https://${CUSTOM_DOMAIN}"
run_behavior_gate
```

The completed one-time legacy rollback rehearsal is evidence in the Phase 1 baseline; do not rerun it after credential rotation. Keep both historical revisions available and do not delete them.

## Replacement Gemini key safety

Create replacement API keys asynchronously and discover completion by metadata. Do not synchronously wait on or describe an API-key operation: provider operation output can include the key string even when a field projection is requested.

Any command capable of returning a credential must send stdout directly to owner-only temporary material or a Secret Manager input pipeline, with stderr controlled separately. Validate non-empty material without printing it, pin the returned numeric Secret Manager version on a zero-traffic revision, verify secure cleanup, and run the complete metadata/behavior/log gate before promotion.

## Upstash overlap safety

Never reset or regenerate the database password as part of overlap testing. First use non-sensitive `ACL LIST` and `ACL GETUSER` checks while keeping the existing URL/token in memory. A replacement ACL user must be limited to `SET`, `EXISTS`, and `DEL` on `declarative:challenge:*`; test allowed operations and denied ACL access before piping its REST token into Secret Manager.

If any ACL policy or password operation is rejected, remove the partial user, verify it is absent, verify production challenge behavior, and leave rotation pending. Irreversible Upstash password regeneration was not approved by Kyle and remains a separate approval-gated operation. Do not improvise with an interactive console or password reset.
