const COMPLETION_EVENT_FIELDS = [
  'event',
  'outcome',
  'revision',
  'config_id',
  'model',
  'thinking_level',
  'thinking_budget',
  'mode',
  'variation_kind',
  'duration_ms',
  'prompt_token_count',
  'candidates_token_count',
  'thoughts_token_count',
  'total_token_count',
  'cached_content_token_count',
  'suggestion_count',
  'finish_reason',
  'timestamp',
];

function tokenCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function safeFinishReason(value) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(normalized) ? normalized : null;
}

export function getGeminiFinishReason(response) {
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  return safeFinishReason(candidates[0]?.finishReason);
}

export function buildGeminiCompletionEvent({
  outcome,
  revision,
  config,
  mode,
  variationKind,
  durationMs,
  usageMetadata,
  suggestionCount,
  finishReason,
  timestamp = new Date().toISOString(),
} = {}) {
  const event = {
    event: 'gemini_model_completion',
    outcome,
    revision: revision ?? null,
    config_id: config?.id ?? null,
    model: config?.model ?? null,
    thinking_level: config?.thinkingLevel ?? null,
    thinking_budget: config?.thinkingBudget ?? null,
    mode: mode ?? null,
    variation_kind: variationKind ?? null,
    duration_ms: nonNegativeInteger(durationMs),
    prompt_token_count: tokenCount(usageMetadata?.promptTokenCount),
    candidates_token_count: tokenCount(usageMetadata?.candidatesTokenCount),
    thoughts_token_count: tokenCount(usageMetadata?.thoughtsTokenCount),
    total_token_count: tokenCount(usageMetadata?.totalTokenCount),
    cached_content_token_count: tokenCount(usageMetadata?.cachedContentTokenCount),
    suggestion_count: nonNegativeInteger(suggestionCount),
    finish_reason: safeFinishReason(finishReason),
    timestamp,
  };

  return Object.fromEntries(COMPLETION_EVENT_FIELDS.map((field) => [field, event[field]]));
}

export function logGeminiCompletionEvent(details, log = console.info) {
  const event = buildGeminiCompletionEvent(details);
  log(JSON.stringify(event));
  return event;
}
