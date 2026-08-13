import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');
const workerPath = path.join(repoRoot, 'scripts', 'test-fixtures', 'gemini-migration-writer-worker.mjs');
const entryPoints = [
  ['check-gemini-models.mjs', 'writeGeminiModelComparisonArtifacts'],
  ['check-get-more-ideas-multiround.mjs', 'writeGetMoreIdeasArtifacts'],
  ['check-variation-prompts.mjs', 'writeVariationArtifacts'],
  ['run-interest-generalization-check.mjs', 'writeInterestGeneralizationArtifacts'],
  ['run-model-bakeoff.mjs', 'writeMigrationReportArtifacts'],
];

async function assertPrivateTree(artifactPaths) {
  for (const filePath of Object.values(artifactPaths)) {
    assert.equal((await stat(path.dirname(filePath))).mode & 0o777, 0o700, filePath);
    assert.equal((await stat(filePath)).mode & 0o777, 0o600, filePath);
  }
  const directoryEntries = await readdir(path.dirname(artifactPaths.json));
  assert.equal(directoryEntries.some((entry) => entry.endsWith('.tmp')), false);
}

for (const [scriptName, exportName] of entryPoints) {
  test(`${scriptName} writes every timestamped/latest artifact privately and atomically`, { timeout: 5_000 }, async (t) => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-private-writer-'));
    t.after(() => rm(outputRoot, { recursive: true, force: true }));
    const moduleUrl = pathToFileURL(path.join(repoRoot, 'scripts', scriptName)).href;
    const result = await run(process.execPath, [workerPath, JSON.stringify({
      moduleUrl, exportName, outputRoot, id: path.basename(scriptName, '.mjs'),
    })], { cwd: repoRoot, env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '' } });
    await assertPrivateTree(JSON.parse(result.stdout.trim()));
  });
}

test('run-model-bakeoff rebuild-latest writer uses the same private atomic path', { timeout: 5_000 }, async (t) => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'declarative-private-rebuild-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const moduleUrl = pathToFileURL(path.join(repoRoot, 'scripts', 'run-model-bakeoff.mjs')).href;
  const result = await run(process.execPath, [workerPath, JSON.stringify({
    moduleUrl,
    exportName: 'writeRebuiltLatestArtifacts',
    outputRoot,
    id: 'rebuild-latest',
    kind: 'rebuild',
  })], { cwd: repoRoot, env: { ...process.env, GEMINI_API_KEY: '', GOOGLE_API_KEY: '' } });
  const paths = JSON.parse(result.stdout.trim());
  await assertPrivateTree({
    json: paths.latestJson,
    markdown: paths.latestMarkdown,
  });
});
