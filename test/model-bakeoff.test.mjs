import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  normalizeBakeoffPayloadForCurrentRegistry,
  renderBakeoffMarkdown,
  summarizeBakeoffResults,
} from '../scripts/run-model-bakeoff.mjs';

const CURRENT_IDS = [
  'gemini-2.5-flash-baseline',
  'gemini-3.5-flash-lite-minimal',
  'gemini-3.6-flash-minimal',
  'gemini-3.6-flash-medium',
];

function currentCandidate(id) {
  return { id, model: 'legacy-metadata-must-not-survive' };
}

function result(candidateId, usageMetadata, estimatedUsd = 0) {
  return {
    candidateId,
    caseId: 'case-1',
    durationMs: 100,
    usageMetadata,
    estimatedUsd,
    translations: [{ translation: 'Try this.' }],
  };
}

test('rebuild normalization removes stale candidates and their rows before latest artifacts are rewritten', async () => {
  const legacyPayload = {
    candidates: [
      ...CURRENT_IDS.map(currentCandidate),
      currentCandidate('gemini-3.1-flash-lite'),
      currentCandidate('gemini-3-flash-preview'),
      currentCandidate('gemini-2.5-pro'),
      currentCandidate('gemini-3.5-flash'),
    ],
    results: [
      ...CURRENT_IDS.map((id) => result(id, { promptTokenCount: 1, candidatesTokenCount: 1, thoughtsTokenCount: 0 })),
      result('gemini-3.1-flash-lite', { promptTokenCount: 999, candidatesTokenCount: 999, thoughtsTokenCount: 999 }),
      result('gemini-3-flash-preview', { promptTokenCount: 999, candidatesTokenCount: 999, thoughtsTokenCount: 999 }),
      result('gemini-2.5-pro', { promptTokenCount: 999, candidatesTokenCount: 999, thoughtsTokenCount: 999 }),
      result('gemini-3.5-flash', { promptTokenCount: 999, candidatesTokenCount: 999, thoughtsTokenCount: 999 }),
    ],
  };

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-bakeoff-'));
  const legacyArtifactPath = path.join(temporaryDirectory, 'latest-model-bakeoff.json');
  await writeFile(legacyArtifactPath, JSON.stringify(legacyPayload));
  const loadedPayload = JSON.parse(await readFile(legacyArtifactPath, 'utf8'));
  await rm(temporaryDirectory, { recursive: true, force: true });
  const normalized = normalizeBakeoffPayloadForCurrentRegistry(loadedPayload);

  assert.deepEqual(normalized.candidates.map((candidate) => candidate.id), CURRENT_IDS);
  assert.deepEqual(normalized.results.map((item) => item.candidateId), CURRENT_IDS);
  assert.equal(normalized.candidates[1].model, 'gemini-3.5-flash-lite', 'latest artifact retained stale candidate metadata instead of the registry model');
});

test('bakeoff summaries and Markdown distinguish visible candidates, thoughts, and billed output', () => {
  const candidates = normalizeBakeoffPayloadForCurrentRegistry({
    candidates: CURRENT_IDS.map(currentCandidate),
    results: [],
  }).candidates;
  const results = [
    result('gemini-3.5-flash-lite-minimal', {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 200_000,
      thoughtsTokenCount: 300_000,
      totalTokenCount: 9_000_000,
    }, 1.55),
  ];
  const summary = summarizeBakeoffResults(results, candidates);
  const flashLite = summary.find((item) => item.candidateId === 'gemini-3.5-flash-lite-minimal');
  const markdown = renderBakeoffMarkdown({
    generatedAt: '2026-08-13T00:00:00.000Z',
    candidates,
    results,
    summary,
    qualityScored: false,
  });

  assert.deepEqual(
    {
      promptTokens: flashLite.promptTokens,
      candidateOutputTokens: flashLite.candidateOutputTokens,
      thoughtTokens: flashLite.thoughtTokens,
      billedOutputTokens: flashLite.billedOutputTokens,
      estimatedUsd: flashLite.estimatedUsd,
    },
    {
      promptTokens: 1_000_000,
      candidateOutputTokens: 200_000,
      thoughtTokens: 300_000,
      billedOutputTokens: 500_000,
      estimatedUsd: 1.55,
    },
  );
  assert.match(markdown, /Visible Candidate Tokens \| Thought Tokens \| Billed Output Tokens \(Candidates \+ Thoughts\)/);
  assert.match(markdown, /\| gemini-3\.5-flash-lite-minimal \| 1 \| 1 \| 0 \| 0 \| 100 \| 1000000 \| 200000 \| 300000 \| 500000 \| 1\.55 \|/);
  assert.doesNotMatch(JSON.stringify(flashLite), /"outputTokens"/, 'JSON summary still presents visible candidates as all output tokens');
});
