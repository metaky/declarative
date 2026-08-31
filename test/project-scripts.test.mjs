import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageJsonUrl = new URL('../package.json', import.meta.url);

test('exposes the deterministic migration check command', async () => {
  const pkg = JSON.parse(await readFile(packageJsonUrl, 'utf8'));

  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts.check, 'npm run test && npm run lint && npm run build');
});
