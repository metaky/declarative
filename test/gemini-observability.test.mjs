import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildGeminiCompletionEvent,
  getGeminiFinishReason,
  logGeminiCompletionEvent,
} from '../services/geminiObservability.js';

const REQUIRED_EVENT_KEYS = [
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

test('builds one exact, privacy-safe completion event for a successful real model attempt', () => {
  const event = buildGeminiCompletionEvent({
    outcome: 'success',
    revision: 'declarative-00103-safe',
    config: {
      id: 'gemini-3.6-flash-medium',
      model: 'gemini-3.6-flash',
      thinkingLevel: 'medium',
    },
    mode: 'variation',
    variationKind: 'warmer',
    durationMs: 842,
    usageMetadata: {
      promptTokenCount: 121,
      candidatesTokenCount: 89,
      thoughtsTokenCount: 55,
      totalTokenCount: 265,
      cachedContentTokenCount: 8,
      rawProviderPayload: { prompt: 'caregiver prompt must never be logged' },
    },
    suggestionCount: 2,
    finishReason: 'STOP',
    timestamp: '2026-08-13T12:00:00.000Z',
    prompt: 'caregiver prompt must never be logged',
    generatedText: 'generated suggestion must never be logged',
    apiKey: 'AIza-secret-value',
    redisToken: 'redis-secret-value',
    challengeId: 'challenge-secret-value',
    stack: 'Error: provider failure\n    at secret-stack-frame',
    response: { rawProviderPayload: 'provider data must never be logged' },
  });

  assert.deepEqual(Object.keys(event), REQUIRED_EVENT_KEYS);
  assert.deepEqual(event, {
    event: 'gemini_model_completion',
    outcome: 'success',
    revision: 'declarative-00103-safe',
    config_id: 'gemini-3.6-flash-medium',
    model: 'gemini-3.6-flash',
    thinking_level: 'medium',
    thinking_budget: null,
    mode: 'variation',
    variation_kind: 'warmer',
    duration_ms: 842,
    prompt_token_count: 121,
    candidates_token_count: 89,
    thoughts_token_count: 55,
    total_token_count: 265,
    cached_content_token_count: 8,
    suggestion_count: 2,
    finish_reason: 'STOP',
    timestamp: '2026-08-13T12:00:00.000Z',
  });
  assert.doesNotMatch(JSON.stringify(event), /caregiver prompt|generated suggestion|AIza-secret|redis-secret|challenge-secret|secret-stack|provider data/i);
});

test('logs one exact classified completion event for a failed real model attempt without error details', () => {
  const logged = [];
  const event = logGeminiCompletionEvent({
    outcome: 'timeout',
    revision: null,
    config: {
      id: 'gemini-2.5-flash-baseline',
      model: 'gemini-2.5-flash',
      thinkingBudget: 0,
    },
    mode: 'translate',
    variationKind: undefined,
    durationMs: 30_000,
    usageMetadata: undefined,
    suggestionCount: 0,
    finishReason: undefined,
    timestamp: '2026-08-13T12:01:00.000Z',
    error: new Error('provider response and stack must never be logged'),
  }, (serializedEvent) => logged.push(serializedEvent));

  assert.equal(logged.length, 1);
  assert.equal(logged[0], JSON.stringify(event));
  assert.deepEqual(Object.keys(JSON.parse(logged[0])), REQUIRED_EVENT_KEYS);
  assert.deepEqual(JSON.parse(logged[0]), {
    event: 'gemini_model_completion',
    outcome: 'timeout',
    revision: null,
    config_id: 'gemini-2.5-flash-baseline',
    model: 'gemini-2.5-flash',
    thinking_level: null,
    thinking_budget: 0,
    mode: 'translate',
    variation_kind: null,
    duration_ms: 30_000,
    prompt_token_count: null,
    candidates_token_count: null,
    thoughts_token_count: null,
    total_token_count: null,
    cached_content_token_count: null,
    suggestion_count: 0,
    finish_reason: null,
    timestamp: '2026-08-13T12:01:00.000Z',
  });
  assert.doesNotMatch(logged[0], /provider response|stack must never be logged/i);
});

const SDK_FINISH_REASONS = [
  'FINISH_REASON_UNSPECIFIED',
  'STOP',
  'MAX_TOKENS',
  'SAFETY',
  'RECITATION',
  'LANGUAGE',
  'OTHER',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'MALFORMED_FUNCTION_CALL',
  'IMAGE_SAFETY',
  'UNEXPECTED_TOOL_CALL',
  'IMAGE_PROHIBITED_CONTENT',
  'NO_IMAGE',
  'IMAGE_RECITATION',
  'IMAGE_OTHER',
];

for (const finishReason of SDK_FINISH_REASONS) {
  test(`keeps the current SDK ${finishReason} finish reason in telemetry`, () => {
    assert.equal(getGeminiFinishReason({ candidates: [{ finishReason }] }), finishReason);
  });
}

for (const finishReason of ['PROMPT_SECRET_VALUE', 'ARBITRARY_PROVIDER_REASON', 'STOP_NOW', '']) {
  test(`drops unrecognized provider finish reason ${finishReason || 'empty'}`, () => {
    assert.equal(getGeminiFinishReason({ candidates: [{ finishReason }] }), null);
  });
}

test('does not throw or retry when the telemetry sink rejects a completion event', () => {
  let attempts = 0;
  const event = logGeminiCompletionEvent({
    outcome: 'api_error',
    config: { id: 'gemini-2.5-flash-baseline', model: 'gemini-2.5-flash', thinkingBudget: 0 },
    mode: 'translate',
    durationMs: 5,
    suggestionCount: 0,
    timestamp: '2026-08-13T12:02:00.000Z',
  }, () => {
    attempts += 1;
    throw new Error('telemetry destination unavailable');
  });

  assert.equal(attempts, 1, 'a failed telemetry write must not trigger a second completion event attempt');
  assert.equal(event.outcome, 'api_error');
});
