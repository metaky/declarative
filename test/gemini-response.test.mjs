import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyGeminiFailure,
  isGeminiResponseBlocked,
  raceGeminiRequestWithTimeout,
  validateGeminiResponse,
} from '../services/geminiResponse.js';

const THREE_VALID = '[{"translation":"The blocks have a spot on the shelf."},{"translation":"The shelf is ready for the blocks."},{"translation":"The blocks can head to their shelf."}]';
const FOUR_VALID = '[{"translation":"The blocks have a spot on the shelf."},{"translation":"The shelf is ready for the blocks."},{"translation":"The blocks can head to their shelf."},{"translation":"The basket is open for blocks."}]';
const TWO_VARIATIONS = '[{"translation":"The shelf is ready for the blocks."},{"translation":"The blocks can head to their shelf."}]';

const RESPONSE_CASES = [
  {
    name: 'accepts a complete plain JSON initial response',
    input: { responseText: THREE_VALID, mode: 'translate' },
    want: { code: 'success', suggestions: [
      { translation: 'The blocks have a spot on the shelf.' },
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
    ] },
  },
  {
    name: 'accepts a complete fenced JSON More Ideas response',
    input: { responseText: `\`\`\`json\n${FOUR_VALID}\n\`\`\``, mode: 'moreIdeas' },
    want: { code: 'success', suggestions: [
      { translation: 'The blocks have a spot on the shelf.' },
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
      { translation: 'The basket is open for blocks.' },
    ] },
  },
  {
    name: 'rejects malformed provider JSON instead of returning a partial response',
    input: { responseText: '[{"translation":"Almost complete"}', mode: 'translate' },
    want: { code: 'json_parse_failure' },
  },
  {
    name: 'classifies blank provider text as an empty response',
    input: { responseText: '   ', mode: 'translate' },
    want: { code: 'empty_response' },
  },
  {
    name: 'rejects provider JSON objects that are not arrays',
    input: { responseText: '{"translation":"One item"}', mode: 'translate' },
    want: { code: 'schema_failure' },
  },
  {
    name: 'rejects an item with no translation field',
    input: { responseText: '[{}, {"translation":"A"}, {"translation":"B"}]', mode: 'translate' },
    want: { code: 'schema_failure' },
  },
  {
    name: 'rejects an item with a non-string translation',
    input: { responseText: '[{"translation":12}, {"translation":"A"}, {"translation":"B"}]', mode: 'translate' },
    want: { code: 'schema_failure' },
  },
  {
    name: 'rejects an item with a whitespace-only translation',
    input: { responseText: '[{"translation":"   "}, {"translation":"A"}, {"translation":"B"}]', mode: 'translate' },
    want: { code: 'schema_failure' },
  },
  {
    name: 'rejects only exact normalized provider duplicates before returning an otherwise complete initial set',
    input: { responseText: '[{"translation":"The shelf is ready."}, {"translation":" the shelf is ready. "}, {"translation":"The blocks can head over."}, {"translation":"The basket is open."}]', mode: 'translate' },
    want: { code: 'success', suggestions: [
      { translation: 'The shelf is ready.' },
      { translation: 'The blocks can head over.' },
      { translation: 'The basket is open.' },
    ] },
  },
  {
    name: 'rejects More Ideas history duplicates before returning a complete set',
    input: {
      responseText: FOUR_VALID,
      mode: 'moreIdeas',
      existingTranslations: [{ translation: ' the blocks have a spot on the shelf. ' }],
    },
    want: { code: 'success', suggestions: [
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
      { translation: 'The basket is open for blocks.' },
    ] },
  },
  {
    name: 'rejects variation source duplicates before returning exactly two variations',
    input: {
      responseText: '[{"translation":" the blocks have a spot on the shelf. "}, {"translation":"The shelf is ready for the blocks."}, {"translation":"The blocks can head to their shelf."}]',
      mode: 'variation',
      sourceTranslation: { translation: 'The blocks have a spot on the shelf.' },
    },
    want: { code: 'success', suggestions: [
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
    ] },
  },
  {
    name: 'accepts three and four distinct initial or More Ideas suggestions',
    input: { responseText: FOUR_VALID, mode: 'translate' },
    want: { code: 'success', suggestions: [
      { translation: 'The blocks have a spot on the shelf.' },
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
      { translation: 'The basket is open for blocks.' },
    ] },
  },
  {
    name: 'rejects fewer than three initial suggestions after duplicate rejection',
    input: { responseText: '[{"translation":"One."}, {"translation":" one. "}, {"translation":"Two."}]', mode: 'translate' },
    want: { code: 'output_count_failure' },
  },
  {
    name: 'rejects more than four initial or More Ideas suggestions',
    input: { responseText: '[{"translation":"One."}, {"translation":"Two."}, {"translation":"Three."}, {"translation":"Four."}, {"translation":"Five."}]', mode: 'moreIdeas' },
    want: { code: 'output_count_failure' },
  },
  {
    name: 'accepts exactly two distinct variation suggestions',
    input: { responseText: TWO_VARIATIONS, mode: 'variation', sourceTranslation: { translation: 'The blocks have a spot on the shelf.' } },
    want: { code: 'success', suggestions: [
      { translation: 'The shelf is ready for the blocks.' },
      { translation: 'The blocks can head to their shelf.' },
    ] },
  },
  {
    name: 'rejects a variation response with fewer than exactly two suggestions',
    input: { responseText: '[{"translation":"The shelf is ready for the blocks."}]', mode: 'variation', sourceTranslation: { translation: 'The blocks have a spot on the shelf.' } },
    want: { code: 'output_count_failure' },
  },
  {
    name: 'rejects a variation response with more than exactly two suggestions',
    input: { responseText: '[{"translation":"The shelf is ready for the blocks."}, {"translation":"The blocks can head to their shelf."}, {"translation":"The basket is open for blocks."}]', mode: 'variation', sourceTranslation: { translation: 'The blocks have a spot on the shelf.' } },
    want: { code: 'output_count_failure' },
  },
  {
    name: 'classifies a provider-blocked response without attempting to parse it',
    input: { responseText: '', mode: 'translate', blocked: true },
    want: { code: 'blocked_response' },
  },
];

for (const scenario of RESPONSE_CASES) {
  test(scenario.name, () => {
    const result = validateGeminiResponse(scenario.input);

    assert.equal(result.code, scenario.want.code);
    if (scenario.want.suggestions) {
      assert.deepEqual(result.suggestions, scenario.want.suggestions);
    } else {
      assert.equal(result.suggestions, undefined, 'a rejected provider response must not leak a partial list');
    }
  });
}

const VALID_COUNT_CASES = [
  { name: 'translate accepts three valid suggestions', mode: 'translate', responseText: THREE_VALID, wantCount: 3 },
  { name: 'translate accepts four valid suggestions', mode: 'translate', responseText: FOUR_VALID, wantCount: 4 },
  { name: 'More Ideas accepts three valid suggestions', mode: 'moreIdeas', responseText: THREE_VALID, wantCount: 3 },
  { name: 'More Ideas accepts four valid suggestions', mode: 'moreIdeas', responseText: FOUR_VALID, wantCount: 4 },
];

for (const scenario of VALID_COUNT_CASES) {
  test(scenario.name, () => {
    const result = validateGeminiResponse({ mode: scenario.mode, responseText: scenario.responseText });

    assert.equal(result.code, 'success');
    assert.equal(result.suggestions.length, scenario.wantCount);
  });
}

const BLOCKED_FINISH_REASON_CASES = [
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'IMAGE_PROHIBITED_CONTENT',
  'IMAGE_RECITATION',
];

for (const finishReason of BLOCKED_FINISH_REASON_CASES) {
  test(`classifies the SDK's ${finishReason} finish reason as blocked before an empty response escapes`, () => {
    const response = { candidates: [{ finishReason }] };
    const blocked = isGeminiResponseBlocked(response);
    const result = validateGeminiResponse({ responseText: '', mode: 'translate', blocked });

    assert.equal(blocked, true);
    assert.equal(result.code, 'blocked_response');
  });
}

test('normalizes finish-reason casing before classifying a blocked response', () => {
  assert.equal(isGeminiResponseBlocked({ candidates: [{ finishReason: ' safety ' }] }), true);
});

const NON_BLOCKED_FINISH_REASON_CASES = [
  'FINISH_REASON_UNSPECIFIED',
  'STOP',
  'MAX_TOKENS',
  'LANGUAGE',
  'OTHER',
  'MALFORMED_FUNCTION_CALL',
  'UNEXPECTED_TOOL_CALL',
  'NO_IMAGE',
  'IMAGE_OTHER',
];

for (const finishReason of NON_BLOCKED_FINISH_REASON_CASES) {
  test(`does not treat the SDK's ${finishReason} finish reason as content-blocked`, () => {
    assert.equal(isGeminiResponseBlocked({ candidates: [{ finishReason }] }), false);
  });
}

const FAILURE_CASES = [
  { name: 'classifies a timed-out provider request', error: new Error('Request timed out.'), want: 'timeout' },
  { name: 'classifies an ordinary provider request failure', error: new Error('403 provider credential detail'), want: 'api_error' },
];

for (const scenario of FAILURE_CASES) {
  test(scenario.name, () => {
    assert.equal(classifyGeminiFailure(scenario.error), scenario.want);
  });
}

function createTimerHarness() {
  const scheduled = [];
  const cleared = [];

  return {
    clearTimeout(timer) {
      timer.cleared = true;
      cleared.push(timer);
    },
    setTimeout(callback, delayMs) {
      const timer = { callback, cleared: false, delayMs };
      scheduled.push(timer);
      return timer;
    },
    fireNext() {
      const timer = scheduled.find((candidate) => !candidate.cleared);
      assert.ok(timer, 'a timeout must be scheduled before it can win the race');
      timer.callback();
    },
    get cleared() {
      return cleared;
    },
  };
}

const TIMEOUT_CLEANUP_CASES = [
  {
    name: 'clears the timeout after a successful Gemini request settles',
    request: () => Promise.resolve({ text: 'provider response' }),
    verify: async (result) => assert.deepEqual(await result, { text: 'provider response' }),
  },
  {
    name: 'clears the timeout after a failed Gemini request settles',
    request: () => Promise.reject(new Error('provider rejected the request')),
    verify: async (result) => assert.rejects(result, /provider rejected the request/),
  },
];

for (const scenario of TIMEOUT_CLEANUP_CASES) {
  test(scenario.name, async () => {
    const timers = createTimerHarness();
    const result = raceGeminiRequestWithTimeout(scenario.request(), {
      timeoutMs: 30_000,
      setTimeoutFn: timers.setTimeout,
      clearTimeoutFn: timers.clearTimeout,
    });

    await scenario.verify(result);
    assert.equal(timers.cleared.length, 1, 'the settled request must clear its scheduled timeout');
  });
}

test('clears the timeout after the timeout wins the Gemini request race', async () => {
  const timers = createTimerHarness();
  const result = raceGeminiRequestWithTimeout(new Promise(() => {}), {
    timeoutMs: 30_000,
    setTimeoutFn: timers.setTimeout,
    clearTimeoutFn: timers.clearTimeout,
  });

  timers.fireNext();
  await assert.rejects(result, /Request timed out/);
  assert.equal(timers.cleared.length, 1, 'the timeout winner must still be cleared in finally');
});
