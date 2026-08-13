import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildThinkingConfig,
  estimateGeminiCostUsd,
  listEvaluationConfigurations,
} from '../services/geminiConfig.js';
import { buildTranslationPrompt, systemInstruction } from '../services/translationPrompt.js';
import {
  applyCalibratedDecision,
  normalizeVerdict,
} from './evaluator-calibration-utils.mjs';
import { evaluateTranslationSet } from './translation-set-evaluator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const calibrationPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const resultsDir = path.join(repoRoot, 'evals', 'results');

const MODEL_CANDIDATES = listEvaluationConfigurations();

function normalizeBakeoffPayloadForCurrentRegistry(payload) {
  const currentIds = new Set(MODEL_CANDIDATES.map((candidate) => candidate.id));
  return {
    ...payload,
    candidates: MODEL_CANDIDATES,
    results: (payload.results ?? []).filter((result) => currentIds.has(result.candidateId)),
  };
}

function loadEnv() {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && !process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function getNumericArg(name, fallback) {
  const parsed = Number(getArg(name, fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getCandidateFilter() {
  const raw = getArg('candidates', '');
  if (!raw) return null;
  return new Set(raw.split(',').map((item) => item.trim()).filter(Boolean));
}

function getCaseIdFilter() {
  const raw = getArg('case-ids', '');
  if (!raw) return null;
  return new Set(raw.split(',').map((item) => item.trim()).filter(Boolean));
}

function getSelectedCandidates() {
  const filter = getCandidateFilter();
  if (!filter) return MODEL_CANDIDATES;
  const selected = MODEL_CANDIDATES.filter((candidate) => filter.has(candidate.id) || filter.has(candidate.model));
  const missing = [...filter].filter((id) => !selected.some((candidate) => candidate.id === id || candidate.model === id));
  if (missing.length) {
    throw new Error(`Unknown model candidate(s): ${missing.join(', ')}`);
  }
  return selected;
}

function loadCases(limit) {
  if (!fs.existsSync(calibrationPath)) {
    throw new Error(`Missing ${calibrationPath}. Run npm run quality:calibration-set first.`);
  }
  const calibration = JSON.parse(fs.readFileSync(calibrationPath, 'utf8'));
  const filter = getCaseIdFilter();
  const selected = filter
    ? calibration.items.filter((item) => filter.has(item.id))
    : calibration.items.slice(0, limit);

  if (filter) {
    const missing = [...filter].filter((id) => !selected.some((item) => item.id === id));
    if (missing.length) {
      throw new Error(`Unknown case id(s): ${missing.join(', ')}`);
    }
  }

  return selected.map((item) => ({
    id: item.id,
    text: item.text,
    intent: item.intent,
    tone: item.tone,
    interest: item.interest,
    useFewerWords: item.useFewerWords,
  }));
}

function parseJsonArray(text) {
  try {
    const trimmed = String(text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function addWordCounts(translations = []) {
  return translations.map((item) => ({
    ...item,
    wordCount: String(item.translation ?? '').trim().split(/\s+/).filter(Boolean).length,
  }));
}

async function generate(ai, candidate, testCase) {
  const prompt = buildTranslationPrompt(testCase);
  const startedAt = Date.now();
  const config = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          translation: { type: Type.STRING },
        },
        required: ['translation'],
      },
    },
  };
  config.thinkingConfig = buildThinkingConfig(candidate);
  const baseResult = {
    candidateId: candidate.id,
    model: candidate.model,
    thinkingConfig: config.thinkingConfig,
    caseId: testCase.id,
  };

  try {
    const response = await ai.models.generateContent({
      model: candidate.model,
      contents: prompt,
      config,
    });

    return {
      ...baseResult,
      durationMs: Date.now() - startedAt,
      usageMetadata: response.usageMetadata ?? null,
      estimatedUsd: estimateGeminiCostUsd(candidate, response.usageMetadata),
      translations: addWordCounts(parseJsonArray(response.text).map((item) => ({ translation: item.translation }))),
    };
  } catch (error) {
    return {
      ...baseResult,
      durationMs: Date.now() - startedAt,
      usageMetadata: null,
      estimatedUsd: 0,
      translations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getCaseById(payload, caseId) {
  return payload.cases.find((item) => item.id === caseId) ?? {};
}

function shouldExcludeFromAggregate(testCase) {
  return testCase.tone === 'Interest Based' && !testCase.interest;
}

async function scoreResults(ai, payload) {
  const rows = [];
  for (const result of payload.results) {
    const testCase = getCaseById(payload, result.caseId);
    const excludedFromAggregate = shouldExcludeFromAggregate(testCase);
    const aggregateExclusionReason = excludedFromAggregate
      ? 'Guardrail case only: production blocks Interest Based requests without an entered interest.'
      : null;

    if (result.error || !result.translations?.length) {
      rows.push({
        ...result,
        excludedFromAggregate,
        aggregateExclusionReason,
        postprocessedVerdict: 'Error',
        postprocessReasons: result.error ? [result.error] : ['no translations returned'],
      });
      continue;
    }
    console.log(`- scoring ${result.candidateId}: ${result.caseId}`);
    const evaluationInput = {
      ...testCase,
      id: `${result.candidateId}-${result.caseId}`,
      translations: addWordCounts(result.translations),
    };
    const { evaluation, usageMetadata, evaluatorModel } = await evaluateTranslationSet(ai, evaluationInput);
    const calibratedVerdict = normalizeVerdict(evaluation?.setSummary?.setVerdict ?? evaluation?.verdict);
    const scoredRow = {
      ...result,
      translations: evaluationInput.translations,
      qualityEvaluation: evaluation,
      rawCalibratedVerdict: calibratedVerdict,
      evaluatorUsageMetadata: usageMetadata,
      evaluatorModel,
    };
    const postprocess = applyCalibratedDecision({
      ...evaluationInput,
      evaluation,
      calibratedVerdict,
      interestMissing: evaluationInput.tone === 'Interest Based' && !evaluationInput.interest,
    });
    rows.push({
      ...scoredRow,
      excludedFromAggregate,
      aggregateExclusionReason,
      postprocessedVerdict: postprocess.verdict,
      postprocessReasons: postprocess.reasons,
    });
  }
  return {
    ...payload,
    scoredAt: new Date().toISOString(),
    qualityScored: true,
    results: rows,
  };
}

function verdictCounts(items, selector) {
  return items.reduce((counts, item) => {
    const verdict = normalizeVerdict(selector(item)) ?? 'Unknown';
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    return counts;
  }, {});
}

function formatVerdicts(counts) {
  return `Pass ${counts.Pass ?? 0}, Borderline ${counts.Borderline ?? 0}, Fail ${counts.Fail ?? 0}`;
}

function renderBakeoffMarkdown(payload) {
  const lines = [];
  lines.push('# Gemini Model Bakeoff');
  lines.push('');
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push('');
  lines.push('This report generates candidate outputs and cost/latency evidence. Use Kyle-labeled calibration data before choosing a production model path.');
  lines.push('');
  if (payload.qualityScored) {
    lines.push('Quality note: this bakeoff includes calibrated hybrid scoring. Compare model quality by best usable option count, should-not-show rate, tone/filter consistency, and postprocessed verdicts, not by raw model impressions alone.');
  } else {
    lines.push('Quality caution: this bakeoff is not decision-grade until outputs are scored with the calibrated hybrid evaluator. Compare model quality by best usable option count, should-not-show rate, tone/filter consistency, and postprocessed verdicts, not by raw model impressions alone.');
  }
  lines.push('');
  lines.push('## Candidates');
  lines.push('');
  lines.push('| Candidate | Model | Thinking | Input $/1M | Output $/1M | Note |');
  lines.push('|---|---|---:|---:|---:|---|');
  for (const candidate of payload.candidates) {
    lines.push(`| ${candidate.id} | ${candidate.model} | ${JSON.stringify(buildThinkingConfig(candidate))} | ${candidate.inputUsdPerMillion} | ${candidate.outputUsdPerMillion} | ${candidate.pricingNote} |`);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Candidate | Runs | Aggregate Runs | Excluded | Errors | Avg Latency ms | Prompt Tokens | Visible Candidate Tokens | Thought Tokens | Billed Output Tokens (Candidates + Thoughts) | Estimated USD | Postprocessed Verdicts | Avg Usable | Avg Excellent | Should-Not-Show |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const summary of payload.summary) {
    lines.push(`| ${summary.candidateId} | ${summary.runs} | ${summary.aggregateRuns ?? summary.runs} | ${summary.excludedFromAggregate ?? 0} | ${summary.errors ?? 0} | ${summary.avgLatencyMs} | ${summary.promptTokens} | ${summary.candidateOutputTokens} | ${summary.thoughtTokens} | ${summary.billedOutputTokens} | ${summary.estimatedUsd} | ${summary.postprocessedVerdicts ?? 'not scored'} | ${summary.avgUsableOptions ?? 'n/a'} | ${summary.avgExcellentOptions ?? 'n/a'} | ${summary.shouldNotShowOptions ?? 'n/a'} |`);
  }
  if (payload.qualityScored) {
    const evaluatorPromptTokens = payload.results.reduce((sum, item) => sum + (item.evaluatorUsageMetadata?.promptTokenCount ?? 0), 0);
    const evaluatorCandidateOutputTokens = payload.results.reduce((sum, item) => sum + (item.evaluatorUsageMetadata?.candidatesTokenCount ?? 0), 0);
    const evaluatorThoughtTokens = payload.results.reduce((sum, item) => sum + (item.evaluatorUsageMetadata?.thoughtsTokenCount ?? 0), 0);
    lines.push('');
    lines.push(`Evaluator token use: prompt ${evaluatorPromptTokens}, visible candidates ${evaluatorCandidateOutputTokens}, thoughts ${evaluatorThoughtTokens}, billed output (candidates + thoughts) ${evaluatorCandidateOutputTokens + evaluatorThoughtTokens}. This is eval-only cost, not production translation cost.`);
  }
  lines.push('');
  lines.push('## Outputs');
  lines.push('');
  for (const result of payload.results) {
    lines.push(`### ${result.candidateId} / ${result.caseId}`);
    lines.push('');
    lines.push(`- Latency: ${result.durationMs} ms`);
    const candidateOutputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    const thoughtTokens = result.usageMetadata?.thoughtsTokenCount ?? 0;
    lines.push(`- Tokens: prompt ${result.usageMetadata?.promptTokenCount ?? 0}; visible candidates ${candidateOutputTokens}; thoughts ${thoughtTokens}; billed output (candidates + thoughts) ${candidateOutputTokens + thoughtTokens}`);
    lines.push(`- Estimated USD: ${result.estimatedUsd}`);
    if (result.error) {
      lines.push(`- Error: ${result.error}`);
    }
    if (payload.qualityScored) {
      lines.push(`- Postprocessed verdict: ${result.postprocessedVerdict ?? 'n/a'}`);
      lines.push(`- Raw calibrated verdict: ${result.rawCalibratedVerdict ?? 'n/a'}`);
      if (result.excludedFromAggregate) lines.push(`- Aggregate exclusion: ${result.aggregateExclusionReason}`);
      if (result.postprocessReasons?.length) lines.push(`- Postprocess reasons: ${result.postprocessReasons.join('; ')}`);
      lines.push(`- Evaluator recommendation: ${result.qualityEvaluation?.recommendation ?? 'n/a'}`);
    }
    lines.push('');
    if (result.translations?.length) {
      result.translations.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.translation}`);
      });
    } else {
      lines.push('No translations returned.');
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function summarizeBakeoffResults(results, candidates = MODEL_CANDIDATES) {
  return candidates.map((candidate) => {
    const items = results.filter((result) => result.candidateId === candidate.id);
    const aggregateItems = items.filter((item) => !item.excludedFromAggregate);
    const sum = (selector) => aggregateItems.reduce((total, item) => total + selector(item), 0);
    const qualitySummaries = aggregateItems.map((item) => item.qualityEvaluation?.setSummary).filter(Boolean);
    const errorCount = items.filter((item) => item.error).length;
    const avg = (selector) => qualitySummaries.length
      ? Number((qualitySummaries.reduce((total, item) => total + selector(item), 0) / qualitySummaries.length).toFixed(2))
      : null;
    const counts = verdictCounts(aggregateItems, (item) => item.postprocessedVerdict);
    return {
      candidateId: candidate.id,
      runs: items.length,
      aggregateRuns: aggregateItems.length,
      excludedFromAggregate: items.length - aggregateItems.length,
      avgLatencyMs: aggregateItems.length ? Math.round(sum((item) => item.durationMs) / aggregateItems.length) : 0,
      promptTokens: sum((item) => item.usageMetadata?.promptTokenCount ?? 0),
      candidateOutputTokens: sum((item) => item.usageMetadata?.candidatesTokenCount ?? 0),
      thoughtTokens: sum((item) => item.usageMetadata?.thoughtsTokenCount ?? 0),
      billedOutputTokens: sum((item) => (item.usageMetadata?.candidatesTokenCount ?? 0) + (item.usageMetadata?.thoughtsTokenCount ?? 0)),
      estimatedUsd: Number(sum((item) => item.estimatedUsd).toFixed(6)),
      postprocessedVerdicts: qualitySummaries.length ? formatVerdicts(counts) : null,
      avgUsableOptions: avg((item) => item.bestOptionCount ?? 0),
      avgExcellentOptions: avg((item) => item.excellentOptionCount ?? 0),
      shouldNotShowOptions: qualitySummaries.length ? sum((item) => item.qualityEvaluation?.setSummary?.shouldNotShowOptionCount ?? 0) : null,
      errors: errorCount,
    };
  });
}

export {
  normalizeBakeoffPayloadForCurrentRegistry,
  renderBakeoffMarkdown,
  summarizeBakeoffResults,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv();
  const apiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running this bakeoff.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

if (hasFlag('score-latest')) {
  const latestJsonPath = path.join(resultsDir, 'latest-model-bakeoff.json');
  const existingPayload = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  const payload = normalizeBakeoffPayloadForCurrentRegistry(existingPayload);
  const scoredPayload = await scoreResults(ai, payload);
  scoredPayload.summary = summarizeBakeoffResults(scoredPayload.results, scoredPayload.candidates);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `model-bakeoff-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `model-bakeoff-${timestamp}.md`);
  const latestMarkdownPath = path.join(resultsDir, 'latest-model-bakeoff.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(scoredPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderBakeoffMarkdown(scoredPayload));
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(scoredPayload, null, 2)}\n`);
  fs.writeFileSync(latestMarkdownPath, renderBakeoffMarkdown(scoredPayload));
  console.log(`Wrote ${markdownPath}`);
  process.exit(0);
}

if (hasFlag('rebuild-latest')) {
  const latestJsonPath = path.join(resultsDir, 'latest-model-bakeoff.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-model-bakeoff.md');
  const existingPayload = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  const payload = normalizeBakeoffPayloadForCurrentRegistry(existingPayload);
  payload.summary = summarizeBakeoffResults(payload.results, payload.candidates);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(latestMarkdownPath, renderBakeoffMarkdown(payload));
  console.log(`Updated latest JSON at ${latestJsonPath}`);
  console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
  process.exit(0);
}

const limit = getNumericArg('limit', hasFlag('full') ? 40 : 8);
const cases = loadCases(limit);
const selectedCandidates = getSelectedCandidates();
const results = [];

console.log(`Running model bakeoff for ${cases.length} case(s) across ${selectedCandidates.length} candidate(s).`);
for (const candidate of selectedCandidates) {
  for (const testCase of cases) {
    console.log(`- ${candidate.id}: ${testCase.id}`);
    results.push(await generate(ai, candidate, testCase));
  }
}

let payload = {
  generatedAt: new Date().toISOString(),
  sourceDocs: [
    'https://ai.google.dev/gemini-api/docs/models',
    'https://ai.google.dev/gemini-api/docs/pricing',
  ],
  candidates: selectedCandidates,
  cases,
  summary: summarizeBakeoffResults(results, selectedCandidates),
  results,
};

if (hasFlag('score')) {
  payload = await scoreResults(ai, payload);
  payload.summary = summarizeBakeoffResults(payload.results, payload.candidates);
}

fs.mkdirSync(resultsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(resultsDir, `model-bakeoff-${timestamp}.json`);
const markdownPath = path.join(resultsDir, `model-bakeoff-${timestamp}.md`);
const latestJsonPath = path.join(resultsDir, 'latest-model-bakeoff.json');
const latestMarkdownPath = path.join(resultsDir, 'latest-model-bakeoff.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderBakeoffMarkdown(payload));
fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(latestMarkdownPath, renderBakeoffMarkdown(payload));

console.log(`Wrote ${markdownPath}`);
}
