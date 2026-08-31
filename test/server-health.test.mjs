import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import test from 'node:test';

async function findAvailablePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

function requestJson(port, pathname) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.on('error', reject);
  });
}

async function startMockServer() {
  const port = await findAvailablePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: {
      PATH: process.env.PATH,
      PORT: String(port),
      NODE_ENV: 'development',
      DEV_USE_MOCK_TRANSLATIONS: 'true',
      DEV_BYPASS_CHALLENGE: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  const started = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`mock server did not start: ${output}`)), 2_000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes(`Server listening on port ${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.once('exit', (exitCode) => {
      clearTimeout(timeout);
      reject(new Error(`mock server exited before accepting traffic (${exitCode}): ${output}`));
    });
  });

  await started;
  return { child, port };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const stopped = once(child, 'exit');
  child.kill('SIGTERM');
  await stopped;
}

test('serves the exact non-model readiness response on the public API path before static serving', async () => {
  const { child, port } = await startMockServer();
  try {
    const response = await requestJson(port, '/api/healthz');

    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body), { status: 'ok', configuration: 'ready' });
    assert.equal(response.body, '{"status":"ok","configuration":"ready"}');
  } finally {
    await stopServer(child);
  }
});

test('rejects missing production model configuration before serving traffic', async () => {
  const port = await findAvailablePort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { PATH: process.env.PATH, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  const [exitCode] = await once(child, 'exit');

  assert.notEqual(exitCode, 0);
  assert.doesNotMatch(output, /Server listening on port/);
  assert.match(output, /GEMINI_MODEL_CONFIG.*required.*production/i);
});
