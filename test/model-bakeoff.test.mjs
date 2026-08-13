import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  normalizeBakeoffPayloadForCurrentRegistry,
  renderBakeoffMarkdown,
  summarizeBakeoffResults,
} from '../scripts/run-model-bakeoff.mjs';
import { scoreRowsWithCheckpoint } from '../scripts/gemini-migration-eval-utils.mjs';

const CURRENT_IDS = [
  'gemini-2.5-flash-baseline',
  'gemini-3.5-flash-lite-minimal',
  'gemini-3.6-flash-minimal',
  'gemini-3.6-flash-medium',
];

function evaluatorCompletedCall(runId, marker = 'a') {
  const evaluatorRunId = `${runId}:evaluation`;
  return {
    callId: `evaluation:${evaluatorRunId}`,
    runId: evaluatorRunId,
    type: 'evaluation',
    configurationId: CURRENT_IDS[0],
    requestHash: marker.repeat(64),
    liabilityNanoUsd: 1_000_000,
    spendNanoUsd: 10_000,
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, thoughtsTokenCount: 0 },
    providerDurationMs: 25,
    resultAvailable: true,
    resolution: 'provider_response',
    resultCheckpoint: {
      relativePath: `.call-checkpoints/${marker.repeat(64)}.json`,
      sha256: marker.repeat(64),
    },
    completedAt: '2026-08-13T12:00:01.000Z',
  };
}

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

test('evaluator checkpoints each stable run and resumes without re-scoring completed rows', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-score-checkpoint-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const checkpointDirectory = path.join(temporaryDirectory, '.score-checkpoints');
  const checkpointPath = path.join(checkpointDirectory, 'score-checkpoint.json');
  const payload = {
    generatedAt: '2026-08-13T12:00:00.000Z',
    qualityScored: false,
    candidates: [{ id: CURRENT_IDS[0] }],
    results: [
      { runId: 'stable-run-1', candidateId: CURRENT_IDS[0], caseId: 'case-1' },
      { runId: 'stable-run-2', candidateId: CURRENT_IDS[0], caseId: 'case-2' },
    ],
  };
  const firstAttempted = [];
  const completedCalls = new Map([
    ['stable-run-1', evaluatorCompletedCall('stable-run-1', 'a')],
    ['stable-run-2', evaluatorCompletedCall('stable-run-2', 'b')],
  ]);

  await assert.rejects(scoreRowsWithCheckpoint({
    payload,
    checkpointPath,
    scoreRow: async (row) => {
      firstAttempted.push(row.runId);
      if (row.runId === 'stable-run-2') throw new Error('simulated evaluator stop');
      return {
        scoredRow: { ...row, postprocessedVerdict: 'Pass', evaluatorUsd: 0.01 },
        completedCall: completedCalls.get(row.runId),
      };
    },
    getCompletedCall: async (callId) => [...completedCalls.values()].find((item) => item.callId === callId),
    getCheckpointMetadata: async () => ({ cumulativeSpend: { totalSpendUsd: 0.01 } }),
  }), /simulated evaluator stop/);

  assert.deepEqual(firstAttempted, ['stable-run-1', 'stable-run-2']);
  const partial = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.equal((await stat(checkpointDirectory)).mode & 0o777, 0o700);
  assert.equal((await stat(checkpointPath)).mode & 0o777, 0o600);
  assert.equal(partial.qualityScored, false);
  assert.equal(partial.scoringIncomplete, true);
  assert.deepEqual(partial.completedRunIds, ['stable-run-1']);
  assert.equal(partial.results[0].postprocessedVerdict, 'Pass');
  assert.equal(partial.results[0].evaluatorUsd, 0.01);
  assert.match(partial.results[0].evaluatorCheckpointIntegrity.sourceRowHash, /^[a-f0-9]{64}$/);
  assert.equal(
    partial.results[0].evaluatorCheckpointIntegrity.evaluatorRequestHash,
    completedCalls.get('stable-run-1').requestHash,
  );
  assert.match(partial.results[0].evaluatorCheckpointIntegrity.scoredRowHash, /^[a-f0-9]{64}$/);
  assert.match(partial.checkpointHash, /^[a-f0-9]{64}$/);
  assert.equal(partial.cumulativeSpend.totalSpendUsd, 0.01);

  const resumedAttempted = [];
  const completed = await scoreRowsWithCheckpoint({
    payload,
    checkpointPath,
    scoreRow: async (row) => {
      resumedAttempted.push(row.runId);
      return {
        scoredRow: { ...row, postprocessedVerdict: 'Pass', evaluatorUsd: 0.02 },
        completedCall: completedCalls.get(row.runId),
      };
    },
    getCompletedCall: async (callId) => [...completedCalls.values()].find((item) => item.callId === callId),
    getCheckpointMetadata: async () => ({ cumulativeSpend: { totalSpendUsd: 0.03 } }),
  });

  assert.deepEqual(resumedAttempted, ['stable-run-2']);
  assert.equal(completed.qualityScored, true);
  assert.equal(completed.scoringIncomplete, false);
  assert.deepEqual(completed.results.map(({ evaluatorUsd }) => evaluatorUsd), [0.01, 0.02]);
  const finalCheckpoint = JSON.parse(await readFile(checkpointPath, 'utf8'));
  assert.deepEqual(finalCheckpoint.completedRunIds, ['stable-run-1', 'stable-run-2']);
  assert.equal(finalCheckpoint.cumulativeSpend.totalSpendUsd, 0.03);
  assert.equal(finalCheckpoint.qualityScored, true);
});

test('evaluator checkpoint tampering fails closed before any scoring callback can retry', async (t) => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'declarative-score-integrity-'));
  t.after(() => rm(temporaryDirectory, { recursive: true, force: true }));
  const payload = {
    generatedAt: '2026-08-13T12:00:00.000Z',
    qualityScored: false,
    corpus: { path: 'evals/gemini-migration-prompt-set.json', seed: 7 },
    candidates: [{ id: CURRENT_IDS[0] }],
    results: [{
      runId: 'stable-tamper-row',
      candidateId: CURRENT_IDS[0],
      caseId: 'case-1',
      translations: [{ translation: 'Synthetic candidate' }],
    }],
  };
  const completedCall = evaluatorCompletedCall('stable-tamper-row', 'c');
  const validPath = path.join(temporaryDirectory, '.score-checkpoints', 'valid.json');
  await scoreRowsWithCheckpoint({
    payload,
    checkpointPath: validPath,
    scoreRow: async (row) => ({
      scoredRow: {
        ...row,
        postprocessedVerdict: 'Pass',
        qualityEvaluation: { score: 4, recommendation: 'show' },
      },
      completedCall,
    }),
    getCompletedCall: async () => completedCall,
  });
  const valid = JSON.parse(await readFile(validPath, 'utf8'));

  const variants = [
    ['verdict', (checkpoint) => { checkpoint.results[0].postprocessedVerdict = 'Fail'; }],
    ['score', (checkpoint) => { checkpoint.results[0].qualityEvaluation.score = 1; }],
    ['checkpoint hash', (checkpoint) => { checkpoint.checkpointHash = 'd'.repeat(64); }],
  ];
  for (const [label, mutate] of variants) {
    const checkpointPath = path.join(temporaryDirectory, '.score-checkpoints', `${label.replaceAll(' ', '-')}.json`);
    const tampered = structuredClone(valid);
    mutate(tampered);
    await writeFile(checkpointPath, `${JSON.stringify(tampered, null, 2)}\n`);
    let callbackCount = 0;
    await assert.rejects(scoreRowsWithCheckpoint({
      payload,
      checkpointPath,
      scoreRow: async () => { callbackCount += 1; throw new Error('must not retry'); },
      getCompletedCall: async () => completedCall,
    }), /integrity|hash|tamper/i, label);
    assert.equal(callbackCount, 0, label);
  }

  let callbackCount = 0;
  await assert.rejects(scoreRowsWithCheckpoint({
    payload: {
      ...payload,
      results: [{ ...payload.results[0], translations: [{ translation: 'Changed source row' }] }],
    },
    checkpointPath: validPath,
    scoreRow: async () => { callbackCount += 1; throw new Error('must not retry'); },
    getCompletedCall: async () => completedCall,
  }), /source|checkpoint.*match|integrity/i);
  assert.equal(callbackCount, 0);

  const journalTamperPath = path.join(temporaryDirectory, '.score-checkpoints', 'journal-tamper.json');
  await writeFile(journalTamperPath, `${JSON.stringify(valid, null, 2)}\n`);
  await assert.rejects(scoreRowsWithCheckpoint({
    payload,
    checkpointPath: journalTamperPath,
    scoreRow: async () => { callbackCount += 1; throw new Error('must not retry'); },
    getCompletedCall: async () => ({
      ...completedCall,
      resultCheckpoint: { ...completedCall.resultCheckpoint, sha256: 'e'.repeat(64) },
    }),
  }), /completed.*integrity|journal|hash/i);
  assert.equal(callbackCount, 0);
});
