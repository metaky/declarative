import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import {
  buildThinkingConfig,
  estimateGeminiCostUsd,
  getGeminiModelConfig,
  listEvaluationConfigurations,
  resolveGeminiModelConfig,
} from '../services/geminiConfig.js';

const EXPECTED_CONFIGURATIONS = [
  {
    id: 'gemini-2.5-flash-baseline',
    model: 'gemini-2.5-flash',
    thinking: { thinkingBudget: 0 },
    inputUsdPerMillion: 0.30,
    outputUsdPerMillion: 2.50,
    productionAllowed: false,
    deprecated: true,
  },
  {
    id: 'gemini-3.5-flash-lite-minimal',
    model: 'gemini-3.5-flash-lite',
    thinking: { thinkingLevel: 'minimal' },
    inputUsdPerMillion: 0.30,
    outputUsdPerMillion: 2.50,
    productionAllowed: true,
  },
  {
    id: 'gemini-3.6-flash-minimal',
    model: 'gemini-3.6-flash',
    thinking: { thinkingLevel: 'minimal' },
    inputUsdPerMillion: 1.50,
    outputUsdPerMillion: 7.50,
    productionAllowed: true,
  },
  {
    id: 'gemini-3.6-flash-medium',
    model: 'gemini-3.6-flash',
    thinking: { thinkingLevel: 'medium' },
    inputUsdPerMillion: 1.50,
    outputUsdPerMillion: 7.50,
    productionAllowed: true,
  },
];

function startServerWithEnvironment(overrides) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, PORT: '0', ...overrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, 1_000);

    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode, output, timedOut });
    });
  });
}

test('keeps every production-selectable configuration aligned with the approved model, thinking, and pricing request contract', () => {
  const configurations = listEvaluationConfigurations();

  assert.deepEqual(configurations.map(({ id }) => id), EXPECTED_CONFIGURATIONS.map(({ id }) => id));
  for (const expected of EXPECTED_CONFIGURATIONS) {
    const configuration = getGeminiModelConfig(expected.id);
    assert.equal(configuration.model, expected.model, `${expected.id} would send the wrong Gemini model`);
    assert.deepEqual(buildThinkingConfig(configuration), expected.thinking, `${expected.id} would send the wrong thinking request`);
    assert.equal(configuration.inputUsdPerMillion, expected.inputUsdPerMillion, `${expected.id} would misbill prompt tokens`);
    assert.equal(configuration.outputUsdPerMillion, expected.outputUsdPerMillion, `${expected.id} would misbill output tokens`);
    assert.equal(configuration.pricingVerifiedOn, '2026-08-13', `${expected.id} would have unverified pricing metadata`);
    assert.equal(configuration.productionAllowed, expected.productionAllowed, `${expected.id} has incorrect productionAllowed status`);
  }
});

test('uses the 3.5 Flash-Lite minimal baseline when local development does not select a configuration', () => {
  const configuration = resolveGeminiModelConfig({ nodeEnv: 'development', configId: undefined });

  assert.equal(configuration.id, 'gemini-3.5-flash-lite-minimal');
  assert.equal(configuration.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(buildThinkingConfig(configuration), { thinkingLevel: 'minimal' });
});

test('rejects deprecated gemini-2.5-flash-baseline in production', () => {
  assert.throws(
    () => resolveGeminiModelConfig({ nodeEnv: 'production', configId: 'gemini-2.5-flash-baseline' }),
    /GEMINI_MODEL_CONFIG is unknown or not allowed in production: gemini-2.5-flash-baseline/i,
  );
});

test('rejects a missing production configuration before the server can bind', () => {
  assert.throws(
    () => resolveGeminiModelConfig({ nodeEnv: 'production', configId: undefined }),
    /GEMINI_MODEL_CONFIG.*required.*production/i,
  );
});

test('rejects an unknown production configuration before the server can bind', () => {
  assert.throws(
    () => resolveGeminiModelConfig({ nodeEnv: 'production', configId: 'unknown' }),
    /GEMINI_MODEL_CONFIG.*unknown/i,
  );
});

test('stops the production server before it binds when GEMINI_MODEL_CONFIG is unknown', async () => {
  const result = await startServerWithEnvironment({
    NODE_ENV: 'production',
    GEMINI_MODEL_CONFIG: 'unknown',
  });

  assert.equal(result.timedOut, false, 'server kept running instead of rejecting the unknown production configuration');
  assert.notEqual(result.exitCode, 0, 'server reported a successful startup with an unknown production configuration');
  assert.doesNotMatch(result.output, /Server listening on port/, 'server bound a port before rejecting the unknown production configuration');
  assert.match(result.output, /GEMINI_MODEL_CONFIG.*unknown/i, 'server did not explain the production configuration error');
});

test('stops the production server before it binds when GEMINI_MODEL_CONFIG is absent', async () => {
  const result = await startServerWithEnvironment({
    NODE_ENV: 'production',
    GEMINI_MODEL_CONFIG: undefined,
  });

  assert.equal(result.timedOut, false, 'server kept running instead of rejecting the missing production configuration');
  assert.notEqual(result.exitCode, 0, 'server reported a successful startup with a missing production configuration');
  assert.doesNotMatch(result.output, /Server listening on port/, 'server bound a port before rejecting the missing production configuration');
  assert.match(result.output, /GEMINI_MODEL_CONFIG.*required.*production/i, 'server did not explain the missing production configuration error');
});

test('stops the production server before it binds when GEMINI_MODEL_CONFIG is deprecated gemini-2.5-flash-baseline', async () => {
  const result = await startServerWithEnvironment({
    NODE_ENV: 'production',
    GEMINI_MODEL_CONFIG: 'gemini-2.5-flash-baseline',
  });

  assert.equal(result.timedOut, false, 'server kept running instead of rejecting deprecated configuration in production');
  assert.notEqual(result.exitCode, 0, 'server reported a successful startup with a deprecated configuration');
  assert.doesNotMatch(result.output, /Server listening on port/, 'server bound a port with deprecated configuration');
  assert.match(result.output, /GEMINI_MODEL_CONFIG is unknown or not allowed in production/i, 'server did not explain disallowed configuration');
});

test('charges visible output and thought tokens once at the output rate without using totalTokenCount', () => {
  const configuration = getGeminiModelConfig('gemini-3.6-flash-medium');
  const cost = estimateGeminiCostUsd(configuration, {
    promptTokenCount: 2_000_000,
    candidatesTokenCount: 300_000,
    thoughtsTokenCount: 700_000,
    totalTokenCount: 9_000_000,
  });

  assert.equal(cost, 10.5);
});
