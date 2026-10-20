import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Check if .env.local provides a real GEMINI_API_KEY and UPSTASH_REDIS_REST_URL
let hasEnvGeminiKey = Boolean(process.env.GEMINI_API_KEY);
let hasEnvRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  if (/^GEMINI_API_KEY=(?!PLACEHOLDER_API_KEY).+/m.test(content)) {
    hasEnvGeminiKey = true;
  }
  if (/^UPSTASH_REDIS_REST_URL=.+/m.test(content) && /^UPSTASH_REDIS_REST_TOKEN=.+/m.test(content)) {
    hasEnvRedis = true;
  }
}

const childProcesses = [
  spawn(process.execPath, ['server.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: '3002',
      DEV_BYPASS_CHALLENGE: process.env.DEV_BYPASS_CHALLENGE ?? (hasEnvRedis ? 'false' : 'true'),
      DEV_USE_MOCK_TRANSLATIONS: process.env.DEV_USE_MOCK_TRANSLATIONS ?? (hasEnvGeminiKey ? 'false' : 'true'),
    },
  }),
  spawn(process.execPath, ['./node_modules/vite/bin/vite.js'], {
    stdio: 'inherit',
  }),
];

const shutdown = (signal) => {
  for (const child of childProcesses) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
};

for (const child of childProcesses) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown(signal);
    process.exit(0);
  });
}
