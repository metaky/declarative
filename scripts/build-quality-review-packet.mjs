import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildTranslationPrompt,
  getToneInstruction,
  systemInstruction,
} from '../services/translationPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(repoRoot, 'evals', 'results');

function readJsonIfExists(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function readModelBakeoffPayloads() {
  if (!fs.existsSync(resultsDir)) return [];
  return fs.readdirSync(resultsDir)
    .filter((fileName) => /^model-bakeoff-.*\.json$/.test(fileName))
    .map((fileName) => {
      const fullPath = path.join(resultsDir, fileName);
      try {
        return {
          fileName,
          payload: JSON.parse(fs.readFileSync(fullPath, 'utf8')),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => String(right.payload.generatedAt ?? '').localeCompare(String(left.payload.generatedAt ?? '')));
}

function latestModelBakeoffMatching(predicate) {
  return readModelBakeoffPayloads().find(({ payload }) => predicate(payload))?.payload ?? null;
}

function readTextIfExists(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function formatVerdictSummary(summary) {
  if (!summary) return 'not available';
  return [
    `${summary.postprocessedVerdicts ?? 'not scored'}`,
    `avg usable ${summary.avgUsableOptions ?? 'n/a'}`,
    `avg excellent ${summary.avgExcellentOptions ?? 'n/a'}`,
    `should-not-show ${summary.shouldNotShowOptions ?? 'n/a'}`,
    `tokens ${summary.promptTokens ?? 'n/a'} in / ${summary.outputTokens ?? 'n/a'} out`,
    `cost $${summary.estimatedUsd ?? 'n/a'}`,
  ].join('; ');
}

function getCaseById(payload, caseId) {
  return payload?.cases?.find((item) => item.id === caseId) ?? {};
}

function isGuardrailOnlyRow(payload, row) {
  if (row?.excludedFromAggregate) return true;
  const testCase = getCaseById(payload, row.caseId);
  return testCase.tone === 'Interest Based' && !testCase.interest;
}

function summarizeCandidate(payload, id) {
  const rows = (payload?.results ?? []).filter((row) => row.candidateId === id || row.variantId === id);
  if (!rows.length) return firstSummaryById(payload, id);

  const aggregateRows = rows.filter((row) => !isGuardrailOnlyRow(payload, row));
  const qualitySummaries = aggregateRows.map((row) => row.qualityEvaluation?.setSummary).filter(Boolean);
  const counts = aggregateRows.reduce((acc, row) => {
    const verdict = row.postprocessedVerdict ?? row.rawCalibratedVerdict ?? row.qualityEvaluation?.setSummary?.setVerdict;
    if (verdict) acc[verdict] = (acc[verdict] ?? 0) + 1;
    return acc;
  }, {});
  const avg = (selector) => qualitySummaries.length
    ? Number((qualitySummaries.reduce((sum, item) => sum + selector(item), 0) / qualitySummaries.length).toFixed(2))
    : null;
  const sum = (selector) => aggregateRows.reduce((total, row) => total + selector(row), 0);

  return {
    candidateId: id,
    runs: rows.length,
    aggregateRuns: aggregateRows.length,
    excludedFromAggregate: rows.length - aggregateRows.length,
    postprocessedVerdicts: `Pass ${counts.Pass ?? 0}, Borderline ${counts.Borderline ?? 0}, Fail ${counts.Fail ?? 0}`,
    avgUsableOptions: avg((item) => item.bestOptionCount ?? 0),
    avgExcellentOptions: avg((item) => item.excellentOptionCount ?? 0),
    shouldNotShowOptions: qualitySummaries.length
      ? sum((row) => row.qualityEvaluation?.setSummary?.shouldNotShowOptionCount ?? 0)
      : null,
    promptTokens: sum((row) => row.usageMetadata?.promptTokenCount ?? row.generation?.usageMetadata?.promptTokenCount ?? 0),
    outputTokens: sum((row) => row.usageMetadata?.candidatesTokenCount ?? row.generation?.usageMetadata?.candidatesTokenCount ?? 0),
    estimatedUsd: Number(sum((row) => row.estimatedUsd ?? 0).toFixed(6)),
    avgLatencyMs: aggregateRows.length
      ? Math.round(sum((row) => row.durationMs ?? row.generation?.durationMs ?? 0) / aggregateRows.length)
      : 0,
    errors: rows.filter((row) => row.error).length,
  };
}

function firstSummaryById(payload, id) {
  return payload?.summary?.find((item) => item.candidateId === id || item.variantId === id) ?? null;
}

function getNonPassRows(payload, limit = 12) {
  return (payload?.results ?? [])
    .filter((row) => !isGuardrailOnlyRow(payload, row))
    .filter((row) => row.postprocessedVerdict && row.postprocessedVerdict !== 'Pass')
    .slice(0, limit);
}

function getGuardrailRows(payload, limit = 6) {
  return (payload?.results ?? [])
    .filter((row) => isGuardrailOnlyRow(payload, row))
    .slice(0, limit);
}

function renderTranslations(row) {
  if (!row?.translations?.length && !row?.generation?.translations?.length) return 'No translations recorded.';
  const translations = row.translations ?? row.generation.translations;
  return translations.map((item, index) => `${index + 1}. ${item.translation}`).join('\n');
}

function renderPromptSample(sample) {
  const prompt = buildTranslationPrompt(sample);
  return [
    `### ${sample.label}`,
    '',
    `- Tone: ${sample.tone}`,
    `- Fewer Words: ${sample.useFewerWords ? 'On' : 'Off'}`,
    sample.interest ? `- Interest: ${sample.interest}` : null,
    '',
    '```txt',
    prompt,
    '```',
    '',
  ].filter((line) => line !== null).join('\n');
}

function buildPacket() {
  const latestHardCaseModel = latestModelBakeoffMatching((payload) => (
    payload?.qualityScored && (payload?.summary?.length ?? 0) > 1
  ));
  const latestFullModel = latestModelBakeoffMatching((payload) => (
    payload?.qualityScored && payload?.summary?.some((item) => (item.runs ?? 0) >= 40)
  ));
  const latestHistory = readJsonIfExists('evals/results/latest-prompt-history-comparison.json');
  const calibratedCheck = readJsonIfExists('evals/results/latest-calibrated-evaluator-check.json');
  const interestGeneralization = readJsonIfExists('evals/results/latest-interest-generalization.json');
  const calibrationPacket = readTextIfExists('evals/results/evaluator-calibration-packet.md');

  const timestamp = new Date().toISOString();
  const lines = [];

  lines.push('# Kyle Translator Quality Review Packet');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('Use this packet for the manual checkpoints before production selection. The goal is not to approve every output; it is to decide whether the current direction gives caregivers at least 1-2 genuinely usable options per set without should-not-show output.');
  lines.push('');
  lines.push('## Decisions Needed');
  lines.push('');
  lines.push('- Do the remaining Borderline examples feel acceptable for production, given the product goal of 1-2 strong usable options per set?');
  lines.push('- Do the multi-interest examples generalize well enough beyond Pokemon?');
  lines.push('- Is the current improvement large enough for final side-by-side approval before commit/deploy?');
  lines.push('');

  lines.push('## Current Scoring Principle');
  lines.push('');
  lines.push('Pass: at least 2 usable options, tone/filter mostly works, and no should-not-show output.');
  lines.push('');
  lines.push('Borderline: 1-2 usable options but tone/filter is inconsistent. One excellent option should prevent an automatic fail unless tone/filter mostly misses, Fewer Words materially misses, coverage is unsafe, or a should-not-show output exists.');
  lines.push('');
  lines.push('Fail: no usable options, selected tone/filter mostly misses, safety/task coverage is unsafe, or any should-not-show output exists.');
  lines.push('');
  lines.push('`hasHarmfulOption` is reserved for should-not-show output only, not ordinary weakness or wrong-tone output.');
  lines.push('');

  lines.push('## Full 40-Case Flash Evidence');
  lines.push('');
  const flashSummary = summarizeCandidate(latestFullModel, 'gemini-2.5-flash-baseline');
  lines.push(`- Latest full Flash run: ${formatVerdictSummary(flashSummary)}`);
  if (flashSummary?.excludedFromAggregate) {
    lines.push(`- Guardrail rows excluded from aggregate: ${flashSummary.excludedFromAggregate}.`);
  }
  lines.push('- Variance run A after latest Interest Based changes: Pass 32, Borderline 4, Fail 3; prompt tokens 37,024; output tokens 3,565; estimated generation cost $0.020017.');
  lines.push('- Variance run B after latest Interest Based changes: Pass 35, Borderline 4, Fail 0; prompt tokens 37,024; output tokens 3,625; estimated generation cost $0.020167.');
  lines.push('- Prior full Flash baseline before Fewer Words/Interest Based tightening: Pass 21, Borderline 4, Fail 15; prompt tokens 27,098; output tokens 4,540; estimated generation cost $0.019481.');
  lines.push('- Current read: quality improved meaningfully. Production generation cost rose slightly in the latest full run, driven by longer prompt instructions, while output tokens are lower than the older baseline.');
  lines.push('');

  lines.push('## Full-Set Remaining Non-Pass Examples');
  lines.push('');
  for (const row of getNonPassRows(latestFullModel)) {
    lines.push(`### ${row.caseId} / ${row.postprocessedVerdict}`);
    lines.push('');
    if (row.postprocessReasons?.length) {
      lines.push(`- Gate reasons: ${row.postprocessReasons.join('; ')}`);
    }
    lines.push(`- Evaluator recommendation: ${row.qualityEvaluation?.recommendation ?? 'n/a'}`);
    lines.push('');
    lines.push(renderTranslations(row));
    lines.push('');
  }

  const guardrailRows = getGuardrailRows(latestFullModel);
  if (guardrailRows.length) {
    lines.push('## Guardrail-Only Rows Excluded From Aggregates');
    lines.push('');
    lines.push('These rows are kept for traceability but are not counted as output-quality failures because production blocks Interest Based requests without an entered interest before a model call.');
    lines.push('');
    for (const row of guardrailRows) {
      lines.push(`### ${row.caseId} / ${row.postprocessedVerdict ?? 'n/a'}`);
      lines.push('');
      if (row.postprocessReasons?.length) lines.push(`- Gate reasons: ${row.postprocessReasons.join('; ')}`);
      lines.push('');
      lines.push(renderTranslations(row));
      lines.push('');
    }
  }

  lines.push('## Interest Generalization Check');
  lines.push('');
  lines.push('This check tests whether Interest Based works beyond Pokemon. Kyle reviewed Minecraft, trains, and Disney examples as generally good to go.');
  lines.push('');
  if (interestGeneralization?.results?.length) {
    const promptTokens = interestGeneralization.results.reduce((sum, row) => sum + (row.usageMetadata?.promptTokenCount ?? 0), 0);
    const outputTokens = interestGeneralization.results.reduce((sum, row) => sum + (row.usageMetadata?.candidatesTokenCount ?? 0), 0);
    lines.push(`- Runs: ${interestGeneralization.results.length}`);
    lines.push(`- Interests: ${interestGeneralization.interests?.join(', ') ?? 'n/a'}`);
    lines.push(`- Tokens: ${promptTokens} in / ${outputTokens} out`);
    lines.push('');
    for (const row of interestGeneralization.results) {
      lines.push(`### ${row.interest} / ${row.inputId}`);
      lines.push('');
      lines.push(`Original: ${row.text}`);
      lines.push('');
      lines.push(renderTranslations(row));
      lines.push('');
    }
  } else {
    lines.push('No interest generalization report was found.');
    lines.push('');
  }

  lines.push('## Hard-Case Model Comparison');
  lines.push('');
  lines.push('This earlier focused run targeted rows where the prompt/model struggled before the latest Interest Based generalization work. Keep it as model/cost context only; the current production candidate should be judged primarily by the latest full 40-case Flash run and the multi-interest generalization check.');
  lines.push('');
  if (latestHardCaseModel?.summary?.length) {
    lines.push('| Candidate | Runs | Verdicts | Avg Usable | Avg Excellent | Avg Latency ms | Estimated Cost | Errors |');
    lines.push('|---|---:|---|---:|---:|---:|---:|---:|');
    for (const rawSummary of latestHardCaseModel.summary) {
      const summary = summarizeCandidate(latestHardCaseModel, rawSummary.candidateId);
      lines.push(`| ${summary.candidateId} | ${summary.runs} | ${summary.postprocessedVerdicts ?? 'not scored'} | ${summary.avgUsableOptions ?? 'n/a'} | ${summary.avgExcellentOptions ?? 'n/a'} | ${summary.avgLatencyMs ?? 'n/a'} | ${summary.estimatedUsd ?? 'n/a'} | ${summary.errors ?? 0} |`);
    }
  } else {
    lines.push('No hard-case model comparison was found.');
  }
  lines.push('');

  lines.push('### Hard-Case Examples To Review');
  lines.push('');
  const exampleIds = [
    'current-10-running-house-interest-based-fewer',
    'current-30-toys-upstairs-interest-based-fewer',
    'anchor-good-interest-light',
  ];
  for (const caseId of exampleIds) {
    lines.push(`#### ${caseId}`);
    lines.push('');
    const rows = (latestHardCaseModel?.results ?? []).filter((row) => row.caseId === caseId);
    for (const row of rows) {
      lines.push(`##### ${row.candidateId} / ${row.postprocessedVerdict ?? 'not scored'}`);
      lines.push('');
      lines.push(`- Latency: ${row.durationMs ?? 'n/a'} ms`);
      lines.push(`- Estimated cost: $${row.estimatedUsd ?? 'n/a'}`);
      if (row.postprocessReasons?.length) lines.push(`- Gate reasons: ${row.postprocessReasons.join('; ')}`);
      lines.push('');
      lines.push(renderTranslations(row));
      lines.push('');
    }
  }

  lines.push('## Prompt Layer Review');
  lines.push('');
  lines.push('### Master Prompt');
  lines.push('');
  lines.push('```txt');
  lines.push(systemInstruction);
  lines.push('```');
  lines.push('');

  lines.push('### Tone Prompts');
  lines.push('');
  for (const tone of ['Default', 'Straightforward', 'Humorous', 'Equalizing']) {
    lines.push(`- ${tone}: ${getToneInstruction(tone)}`);
  }
  lines.push(`- Interest Based with Pokemon: ${getToneInstruction('Interest Based', 'Pokemon')}`);
  lines.push(`- Interest Based with no interest: ${getToneInstruction('Interest Based', '')}`);
  lines.push('');

  lines.push('### Generated Prompt Samples');
  lines.push('');
  const samples = [
    {
      label: 'Safety redirection, Default, Fewer Words',
      text: 'Stop running in the house',
      tone: 'Default',
      useFewerWords: true,
    },
    {
      label: 'Dinner sequence, Equalizing, Fewer Words',
      text: "Please come down and wash your hands. It's dinner time.",
      tone: 'Equalizing',
      useFewerWords: true,
    },
    {
      label: 'Cleanup destination, Interest Based, Fewer Words',
      text: 'Pick up your toys and put them away upstairs in your room',
      tone: 'Interest Based',
      interest: 'Pokemon',
      useFewerWords: true,
    },
  ];
  for (const sample of samples) {
    lines.push(renderPromptSample(sample));
  }

  lines.push('## Historical Comparison Summary');
  lines.push('');
  if (latestHistory?.summary?.length) {
    lines.push('| Prompt Variant | Runs | Verdicts | Avg Usable | Avg Excellent | Prompt Tokens | Output Tokens |');
    lines.push('|---|---:|---|---:|---:|---:|---:|');
    for (const summary of latestHistory.summary) {
      lines.push(`| ${summary.variantId} | ${summary.runs} | ${summary.postprocessedVerdicts ?? 'not scored'} | ${summary.avgUsableOptions ?? 'n/a'} | ${summary.avgExcellentOptions ?? 'n/a'} | ${summary.promptTokens ?? 'n/a'} | ${summary.outputTokens ?? 'n/a'} |`);
    }
  } else {
    lines.push('Historical comparison report was not found.');
  }
  lines.push('');

  lines.push('## Evaluator Calibration Status');
  lines.push('');
  if (calibratedCheck?.summary) {
    lines.push(`- Calibrated evaluator summary: ${JSON.stringify(calibratedCheck.summary)}`);
  } else {
    lines.push('- Latest calibrated evaluator JSON summary was not found.');
  }
  lines.push('- Current recommendation: keep using hybrid evaluation, not raw automated scoring alone.');
  lines.push('');
  if (calibrationPacket) {
    lines.push('Evaluator disagreement packet exists at `evals/results/evaluator-calibration-packet.md`.');
  }
  lines.push('');

  lines.push('## Review Questions');
  lines.push('');
  lines.push('1. Which non-pass examples above are actually acceptable because they include one strong caregiver option?');
  lines.push('2. Which Interest Based examples feel genuinely connected instead of name-dropped or gimmicky?');
  lines.push('3. Do Minecraft, trains, and Disney show enough generalization beyond Pokemon?');
  lines.push('4. Are the compact Fewer Words examples too clipped, or are they appropriately low-auditory-load?');
  lines.push('5. Are any outputs should-not-show, using the stricter meaning of harmful?');
  lines.push('');

  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(resultsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const markdown = buildPacket();
const timestampedPath = path.join(resultsDir, `quality-review-packet-${timestamp}.md`);
const latestPath = path.join(resultsDir, 'latest-quality-review-packet.md');
fs.writeFileSync(timestampedPath, markdown);
fs.writeFileSync(latestPath, markdown);
console.log(`Wrote ${timestampedPath}`);
console.log(`Updated ${latestPath}`);
