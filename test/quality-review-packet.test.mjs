import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBakeoffPayloadForCurrentRegistry,
  summarizeBakeoffResults,
} from '../scripts/run-model-bakeoff.mjs';
import { buildQualityReviewPacket } from '../scripts/build-quality-review-packet.mjs';

function bakeoffResult(caseId) {
  return {
    candidateId: 'gemini-2.5-flash-baseline',
    caseId,
    durationMs: 100,
    usageMetadata: {
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 200_000,
      thoughtsTokenCount: 300_000,
      totalTokenCount: 9_000_000,
    },
    estimatedUsd: 1.55,
    translations: [{ translation: 'Try this.' }],
  };
}

test('quality packet preserves bakeoff visible, thought, and billed output totals instead of presenting candidates as all output', () => {
  const candidates = normalizeBakeoffPayloadForCurrentRegistry({ results: [] }).candidates;
  const results = Array.from({ length: 40 }, (_, index) => bakeoffResult(`case-${index + 1}`));
  const payload = {
    generatedAt: '2026-08-13T00:00:00.000Z',
    qualityScored: true,
    cases: results.map((row) => ({ id: row.caseId, tone: 'Default' })),
    candidates,
    results,
    summary: summarizeBakeoffResults(results, candidates),
  };

  const packet = buildQualityReviewPacket({
    modelBakeoffPayloads: [{ fileName: 'model-bakeoff-2026-08-13.json', payload }],
    latestHistory: null,
    calibratedCheck: null,
    interestGeneralization: null,
    calibrationPacket: null,
  });

  assert.match(
    packet,
    /tokens 40000000 prompt \/ 8000000 visible candidates \/ 12000000 thoughts \/ 20000000 billed output \(candidates \+ thoughts\); cost \$62/,
  );
  assert.doesNotMatch(packet, /tokens 40000000 in \/ 8000000 out/);
});
