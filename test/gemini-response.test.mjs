import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyGeminiFailure,
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

const FAILURE_CASES = [
  { name: 'classifies a timed-out provider request', error: new Error('Request timed out.'), want: 'timeout' },
  { name: 'classifies an ordinary provider request failure', error: new Error('403 provider credential detail'), want: 'api_error' },
];

for (const scenario of FAILURE_CASES) {
  test(scenario.name, () => {
    assert.equal(classifyGeminiFailure(scenario.error), scenario.want);
  });
}
