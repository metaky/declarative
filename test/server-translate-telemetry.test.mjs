import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import test from 'node:test';
import express from 'express';
import { createGeminiTranslationHandler } from '../services/geminiTranslationHandler.js';

const MODEL_CONFIG = {
  id: 'gemini-2.5-flash-baseline',
  model: 'gemini-2.5-flash',
  thinkingBudget: 0,
};
const VALID_TEXT = '[{"translation":"The blocks have a spot on the shelf."},{"translation":"The shelf is ready for the blocks."},{"translation":"The blocks can head to their shelf."}]';

async function findAvailablePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

function postJson(port, body, forwardedFor) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/translate',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
        'x-forwarded-for': forwardedFor,
      },
    }, (response) => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { responseBody += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body: responseBody }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

async function withTranslationServer(options, run) {
  const events = [];
  const app = express();
  app.use(express.json());
  app.set('trust proxy', true);
  app.post('/api/translate', createGeminiTranslationHandler({
    geminiApiKey: 'test-key',
    geminiModelConfig: MODEL_CONFIG,
    geminiThinkingConfig: { thinkingBudget: 0 },
    isDevChallengeBypassEnabled: true,
    completionLogger: (details) => events.push(details),
    ...options,
  }));
  const server = app.listen(await findAvailablePort(), '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();

  try {
    await run({ events, port });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function successfulSdkResponse(overrides = {}) {
  return {
    text: VALID_TEXT,
    candidates: [{ finishReason: 'STOP' }],
    usageMetadata: {
      promptTokenCount: 31,
      candidatesTokenCount: 23,
      thoughtsTokenCount: 0,
      totalTokenCount: 54,
      cachedContentTokenCount: 0,
    },
    ...overrides,
  };
}

const COMPLETION_CASES = [
  {
    name: 'success',
    provider: () => Promise.resolve(successfulSdkResponse()),
    wantStatus: 200,
    wantOutcome: 'success',
  },
  {
    name: 'timeout',
    provider: () => Promise.reject(new Error('Request timed out.')),
    wantStatus: 500,
    wantOutcome: 'timeout',
  },
  {
    name: 'api error',
    provider: () => Promise.reject(new Error('provider unavailable')),
    wantStatus: 500,
    wantOutcome: 'api_error',
  },
  {
    name: 'synchronous api error',
    provider: () => { throw new Error('provider setup failed'); },
    wantStatus: 500,
    wantOutcome: 'api_error',
  },
  {
    name: 'blocked response',
    provider: () => Promise.resolve(successfulSdkResponse({ text: '', candidates: [{ finishReason: 'SAFETY' }] })),
    wantStatus: 500,
    wantOutcome: 'blocked_response',
  },
  {
    name: 'empty response',
    provider: () => Promise.resolve(successfulSdkResponse({ text: '' })),
    wantStatus: 500,
    wantOutcome: 'empty_response',
  },
  {
    name: 'JSON parse failure',
    provider: () => Promise.resolve(successfulSdkResponse({ text: '[{"translation":"unfinished"}' })),
    wantStatus: 500,
    wantOutcome: 'json_parse_failure',
  },
  {
    name: 'schema failure',
    provider: () => Promise.resolve(successfulSdkResponse({ text: '[{"translation":12},{"translation":"Two"},{"translation":"Three"}]' })),
    wantStatus: 500,
    wantOutcome: 'schema_failure',
  },
  {
    name: 'output count failure',
    provider: () => Promise.resolve(successfulSdkResponse({ text: '[{"translation":"Only one"},{"translation":"Only two"}]' })),
    wantStatus: 500,
    wantOutcome: 'output_count_failure',
  },
];

for (const [index, scenario] of COMPLETION_CASES.entries()) {
  test(`emits exactly one ${scenario.wantOutcome} completion event for a ${scenario.name} model attempt`, async () => {
    await withTranslationServer({
      createGeminiClient: () => ({ models: { generateContent: scenario.provider } }),
    }, async ({ events, port }) => {
      const response = await postJson(port, { mode: 'translate', text: 'Please put the blocks away.' }, `203.0.113.${index + 1}`);

      assert.equal(response.statusCode, scenario.wantStatus);
      if (scenario.wantStatus === 200) {
        assert.equal(JSON.parse(response.body).length, 3);
      } else {
        assert.deepEqual(JSON.parse(response.body), { error: 'AI translation unavailable.' });
      }
      assert.equal(events.length, 1);
      assert.equal(events[0].outcome, scenario.wantOutcome);
      assert.equal(events[0].config.id, 'gemini-2.5-flash-baseline');
      assert.equal(events[0].mode, 'translate');
    });
  });
}

test('does not emit a model completion event when mock mode returns local translations', async () => {
  await withTranslationServer({
    isMockTranslationMode: true,
    createGeminiClient: () => { throw new Error('mock mode must not create a Gemini client'); },
    buildMockTranslations: () => JSON.parse(VALID_TEXT),
  }, async ({ events, port }) => {
    const response = await postJson(port, { mode: 'translate', text: 'Please put the blocks away.' }, '203.0.113.20');

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).length, 3);
    assert.equal(events.length, 0);
  });
});

test('keeps a successful model response successful when telemetry logging throws once', async () => {
  let attempts = 0;
  await withTranslationServer({
    createGeminiClient: () => ({ models: { generateContent: () => Promise.resolve(successfulSdkResponse()) } }),
    completionLogger: () => {
      attempts += 1;
      throw new Error('telemetry sink unavailable');
    },
  }, async ({ port }) => {
    const response = await postJson(port, { mode: 'translate', text: 'Please put the blocks away.' }, '203.0.113.21');

    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).length, 3);
  });
  assert.equal(attempts, 1);
});

test('keeps the safe failure fallback when telemetry logging throws once', async () => {
  let attempts = 0;
  await withTranslationServer({
    createGeminiClient: () => ({ models: { generateContent: () => Promise.reject(new Error('provider unavailable')) } }),
    completionLogger: () => {
      attempts += 1;
      throw new Error('telemetry sink unavailable');
    },
  }, async ({ port }) => {
    const response = await postJson(port, { mode: 'translate', text: 'Please put the blocks away.' }, '203.0.113.22');

    assert.equal(response.statusCode, 500);
    assert.deepEqual(JSON.parse(response.body), { error: 'AI translation unavailable.' });
  });
  assert.equal(attempts, 1);
});
