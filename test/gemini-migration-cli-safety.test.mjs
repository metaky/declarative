import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const run = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');
const migrationCliPaths = [
  'check-gemini-models.mjs',
  'check-get-more-ideas-multiround.mjs',
  'check-variation-prompts.mjs',
  'run-interest-generalization-check.mjs',
  'run-model-bakeoff.mjs',
].map((fileName) => path.join(repoRoot, 'scripts', fileName));
const ledgerPath = path.join(repoRoot, 'evals', 'results', 'gemini-migration', 'phase-3-spend.json');
const cleanEnv = { ...process.env };
delete cleanEnv.GEMINI_API_KEY;
delete cleanEnv.GOOGLE_API_KEY;
delete cleanEnv.GOOGLE_APPLICATION_CREDENTIALS;

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

test('there is no executable migration recovery package command', async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(Object.hasOwn(packageJson.scripts, 'quality:migration-recover'), false);
  await assert.rejects(
    run('npm', ['run', 'quality:migration-recover', '--', '--help'], { cwd: repoRoot, env: cleanEnv }),
    (error) => error.code === 1 && /missing script/i.test(error.stderr),
  );
});

test('every migration CLI help path returns keylessly before parsing paid-run options', { timeout: 5_000 }, async () => {
  const before = await readFile(ledgerPath);
  for (const migrationCliPath of migrationCliPaths) {
    const help = await run(process.execPath, [migrationCliPath, '--help'], { cwd: repoRoot, env: cleanEnv });
    assert.match(help.stdout, /usage:/i, path.basename(migrationCliPath));
  }
  assert.equal(digest(await readFile(ledgerPath)), digest(before));
});

test('all generated migration artifacts are ignored while the canonical ledger remains stageable', { timeout: 5_000 }, async () => {
  const generatedPaths = [
    'evals/results/gemini-migration/latest-model-bakeoff.json',
    'evals/results/gemini-migration/model-bakeoff-2026-08-13T00-00-00-000Z.md',
    'evals/results/gemini-migration/nested/latest-report.json',
    'evals/results/gemini-migration/nested/report-2026-08-13.json',
    'evals/results/gemini-migration/.call-checkpoints/result.json',
    'evals/results/gemini-migration/.score-checkpoints/result.json',
  ];
  for (const generatedPath of generatedPaths) {
    const result = await run('git', ['check-ignore', '--no-index', generatedPath], { cwd: repoRoot });
    assert.match(result.stdout, new RegExp(`${generatedPath.replaceAll('.', '\\.')}\\s*$`));
  }

  await assert.rejects(
    run('git', ['check-ignore', '--no-index', 'evals/results/gemini-migration/phase-3-spend.json'], { cwd: repoRoot }),
    (error) => error.code === 1,
  );
});
