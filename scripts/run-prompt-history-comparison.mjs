import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildTranslationPrompt as buildWorkingPrompt,
  systemInstruction as workingSystemInstruction,
} from '../services/translationPrompt.js';
import {
  applyCalibratedDecision,
  normalizeVerdict,
} from './evaluator-calibration-utils.mjs';
import { evaluateTranslationSet } from './translation-set-evaluator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const calibrationPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const resultsDir = path.join(repoRoot, 'evals', 'results');
const envPath = path.join(repoRoot, '.env.local');

const PROMPT_VARIANTS = [
  {
    id: 'working-tree-latest-attempt',
    ref: null,
    note: 'Current uncommitted working tree prompt.',
  },
  {
    id: 'main-current-production-candidate',
    ref: 'ce64281',
    note: 'Current main HEAD at start of recovery work.',
  },
  {
    id: 'conversational-pre-token-reduction-candidate',
    ref: '91aba8e',
    note: 'Older conversational prompt candidate named in git history.',
  },
];

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

function getNumericArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadCases(limit) {
  if (!fs.existsSync(calibrationPath)) {
    throw new Error(`Missing ${calibrationPath}. Run npm run quality:calibration-set first.`);
  }
  const calibration = JSON.parse(fs.readFileSync(calibrationPath, 'utf8'));
  return calibration.items.slice(0, limit).map((item) => ({
    id: item.id,
    text: item.text,
    existingTranslations: [],
    tone: item.tone,
    interest: item.interest,
    useFewerWords: item.useFewerWords,
  }));
}

function wordCount(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

function addWordCounts(translations = []) {
  return translations.map((item) => ({
    ...item,
    wordCount: wordCount(item.translation),
  }));
}

function gitShow(ref, filePath) {
  return execFileSync('git', ['show', `${ref}:${filePath}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function loadPromptVariant(variant) {
  if (!variant.ref) {
    return {
      ...variant,
      buildTranslationPrompt: buildWorkingPrompt,
      systemInstruction: workingSystemInstruction,
    };
  }

  const source = gitShow(variant.ref, 'services/translationPrompt.js');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'declarative-prompt-history-'));
  const tempPath = path.join(tempDir, `translationPrompt-${variant.ref}.mjs`);
  fs.writeFileSync(tempPath, source);
  const imported = await import(pathToFileURL(tempPath).href);
  return {
    ...variant,
    buildTranslationPrompt: imported.buildTranslationPrompt,
    systemInstruction: imported.systemInstruction,
  };
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

async function maybeGenerate(ai, variant, testCase, prompt) {
  if (!process.argv.includes('--generate')) return null;

  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
      systemInstruction: variant.systemInstruction,
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
    },
  });

  return {
    durationMs: Date.now() - startedAt,
    usageMetadata: response.usageMetadata ?? null,
    translations: addWordCounts(parseJsonArray(response.text).map((item) => ({ translation: item.translation }))),
  };
}

function getCaseById(payload, caseId) {
  return payload.cases.find((item) => item.id === caseId) ?? {};
}

async function scoreResults(ai, payload) {
  const rows = [];
  for (const result of payload.results) {
    if (!result.generation?.translations?.length) {
      rows.push(result);
      continue;
    }
    const testCase = getCaseById(payload, result.caseId);
    console.log(`- scoring ${result.variantId}: ${result.caseId}`);
    const evaluationInput = {
      ...testCase,
      id: `${result.variantId}-${result.caseId}`,
      translations: addWordCounts(result.generation.translations),
    };
    const { evaluation, usageMetadata, evaluatorModel } = await evaluateTranslationSet(ai, evaluationInput);
    const rawCalibratedVerdict = normalizeVerdict(evaluation?.setSummary?.setVerdict ?? evaluation?.verdict);
    const postprocess = applyCalibratedDecision({
      ...evaluationInput,
      evaluation,
      interestMissing: evaluationInput.tone === 'Interest Based' && !evaluationInput.interest,
    });
    rows.push({
      ...result,
      generation: {
        ...result.generation,
        translations: evaluationInput.translations,
      },
      qualityEvaluation: evaluation,
      rawCalibratedVerdict,
      postprocessedVerdict: postprocess.verdict,
      postprocessReasons: postprocess.reasons,
      evaluatorUsageMetadata: usageMetadata,
      evaluatorModel,
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

function summarize(results) {
  return PROMPT_VARIANTS.map((variant) => {
    const items = results.filter((item) => item.variantId === variant.id);
    const qualitySummaries = items.map((item) => item.qualityEvaluation?.setSummary).filter(Boolean);
    const avg = (selector) => items.length
      ? Number((items.reduce((sum, item) => sum + selector(item), 0) / items.length).toFixed(1))
      : 0;
    const avgQuality = (selector) => qualitySummaries.length
      ? Number((qualitySummaries.reduce((sum, item) => sum + selector(item), 0) / qualitySummaries.length).toFixed(2))
      : null;
    const counts = verdictCounts(items, (item) => item.postprocessedVerdict);
    return {
      variantId: variant.id,
      runs: items.length,
      avgSystemWords: avg((item) => item.systemWords),
      avgPromptWords: avg((item) => item.promptWords),
      avgPromptChars: avg((item) => item.promptChars),
      promptTokens: items.reduce((sum, item) => sum + (item.generation?.usageMetadata?.promptTokenCount ?? 0), 0),
      outputTokens: items.reduce((sum, item) => sum + (item.generation?.usageMetadata?.candidatesTokenCount ?? 0), 0),
      postprocessedVerdicts: qualitySummaries.length ? formatVerdicts(counts) : null,
      avgUsableOptions: avgQuality((item) => item.bestOptionCount ?? 0),
      avgExcellentOptions: avgQuality((item) => item.excellentOptionCount ?? 0),
      shouldNotShowOptions: qualitySummaries.length ? items.reduce((sum, item) => sum + (item.qualityEvaluation?.setSummary?.shouldNotShowOptionCount ?? 0), 0) : null,
    };
  });
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push('# Prompt History Comparison');
  lines.push('');
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push('');
  lines.push('Use this report to test whether the older conversational prompt was materially different from current production and the latest prompt attempt.');
  lines.push('');
  if (payload.qualityScored) {
    const maxRuns = Math.max(0, ...payload.summary.map((item) => item.runs ?? 0));
    const scopeNote = maxRuns >= 40
      ? 'This run covers the full 40-case calibration set.'
      : `This run covers ${maxRuns} case(s) per prompt variant; treat it as directional until the full 40-case set is scored.`;
    lines.push(`Quality note: this report includes calibrated hybrid scoring. ${scopeNote}`);
  } else {
    lines.push('Quality caution: this report shows generated outputs, prompt size, and token evidence. Treat quality conclusions as provisional until the outputs are scored with the calibrated hybrid evaluator. Raw Gemini verdicts are not reliable enough for optimization decisions.');
  }
  if (!payload.generatedOutputs) {
    lines.push('');
    lines.push('Output generation was not enabled. Run with `--generate` after Kyle labels the calibration set.');
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Variant | Runs | Avg System Words | Avg Prompt Words | Avg Prompt Chars | Prompt Tokens | Output Tokens | Postprocessed Verdicts | Avg Usable | Avg Excellent | Should-Not-Show |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const summary of payload.summary) {
    lines.push(`| ${summary.variantId} | ${summary.runs} | ${summary.avgSystemWords} | ${summary.avgPromptWords} | ${summary.avgPromptChars} | ${summary.promptTokens} | ${summary.outputTokens} | ${summary.postprocessedVerdicts ?? 'not scored'} | ${summary.avgUsableOptions ?? 'n/a'} | ${summary.avgExcellentOptions ?? 'n/a'} | ${summary.shouldNotShowOptions ?? 'n/a'} |`);
  }
  if (payload.qualityScored) {
    const evaluatorPromptTokens = payload.results.reduce((sum, item) => sum + (item.evaluatorUsageMetadata?.promptTokenCount ?? 0), 0);
    const evaluatorOutputTokens = payload.results.reduce((sum, item) => sum + (item.evaluatorUsageMetadata?.candidatesTokenCount ?? 0), 0);
    lines.push('');
    lines.push(`Evaluator token use: prompt ${evaluatorPromptTokens}, output ${evaluatorOutputTokens}. This is eval-only cost, not production translation cost.`);
  }
  lines.push('');
  lines.push('## Prompt Samples');
  lines.push('');
  for (const result of payload.results) {
    lines.push(`### ${result.variantId} / ${result.caseId}`);
    lines.push('');
    lines.push(`- System words: ${result.systemWords}`);
    lines.push(`- Prompt words: ${result.promptWords}`);
    lines.push('');
    lines.push('```txt');
    lines.push(result.prompt);
    lines.push('```');
    if (result.generation) {
      lines.push('');
      if (payload.qualityScored) {
        lines.push(`- Postprocessed verdict: ${result.postprocessedVerdict ?? 'n/a'}`);
        lines.push(`- Raw calibrated verdict: ${result.rawCalibratedVerdict ?? 'n/a'}`);
        if (result.postprocessReasons?.length) lines.push(`- Postprocess reasons: ${result.postprocessReasons.join('; ')}`);
        lines.push(`- Evaluator recommendation: ${result.qualityEvaluation?.recommendation ?? 'n/a'}`);
        lines.push('');
      }
      lines.push('Outputs:');
      result.generation.translations.forEach((item, index) => {
        lines.push(`${index + 1}. ${item.translation}`);
      });
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

loadEnv();
const generateOutputs = hasFlag('generate');
const apiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
if ((generateOutputs || hasFlag('score') || hasFlag('score-latest')) && !apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before using --generate.');
  process.exit(1);
}

if (hasFlag('score-latest')) {
  const ai = new GoogleGenAI({ apiKey });
  const latestJsonPath = path.join(resultsDir, 'latest-prompt-history-comparison.json');
  const payload = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  const scoredPayload = await scoreResults(ai, payload);
  scoredPayload.summary = summarize(scoredPayload.results);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `prompt-history-comparison-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `prompt-history-comparison-${timestamp}.md`);
  const latestMarkdownPath = path.join(resultsDir, 'latest-prompt-history-comparison.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(scoredPayload, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderMarkdown(scoredPayload));
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(scoredPayload, null, 2)}\n`);
  fs.writeFileSync(latestMarkdownPath, renderMarkdown(scoredPayload));
  console.log(`Wrote ${markdownPath}`);
  process.exit(0);
}

if (hasFlag('rebuild-latest')) {
  const latestJsonPath = path.join(resultsDir, 'latest-prompt-history-comparison.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-prompt-history-comparison.md');
  const payload = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
  payload.summary = summarize(payload.results);
  fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(latestMarkdownPath, renderMarkdown(payload));
  console.log(`Updated latest JSON at ${latestJsonPath}`);
  console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
  process.exit(0);
}

const limit = getNumericArg('limit', generateOutputs ? 8 : 12);
const cases = loadCases(limit);
const ai = (generateOutputs || hasFlag('score')) ? new GoogleGenAI({ apiKey }) : null;
const loadedVariants = [];
for (const variant of PROMPT_VARIANTS) {
  loadedVariants.push(await loadPromptVariant(variant));
}

const results = [];
for (const variant of loadedVariants) {
  for (const testCase of cases) {
    const prompt = variant.buildTranslationPrompt(testCase);
    console.log(`- ${variant.id}: ${testCase.id}`);
    results.push({
      variantId: variant.id,
      variantRef: variant.ref,
      note: variant.note,
      caseId: testCase.id,
      text: testCase.text,
      tone: testCase.tone,
      interest: testCase.interest,
      useFewerWords: testCase.useFewerWords,
      systemWords: wordCount(variant.systemInstruction),
      promptWords: wordCount(prompt),
      promptChars: prompt.length,
      prompt,
      generation: await maybeGenerate(ai, variant, testCase, prompt),
    });
  }
}

let payload = {
  generatedAt: new Date().toISOString(),
  generatedOutputs: generateOutputs,
  variants: PROMPT_VARIANTS,
  cases,
  summary: summarize(results),
  results,
};

if (hasFlag('score')) {
  payload = await scoreResults(ai, payload);
  payload.summary = summarize(payload.results);
}

fs.mkdirSync(resultsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(resultsDir, `prompt-history-comparison-${timestamp}.json`);
const markdownPath = path.join(resultsDir, `prompt-history-comparison-${timestamp}.md`);
const latestJsonPath = path.join(resultsDir, 'latest-prompt-history-comparison.json');
const latestMarkdownPath = path.join(resultsDir, 'latest-prompt-history-comparison.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderMarkdown(payload));
fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(latestMarkdownPath, renderMarkdown(payload));

console.log(`Wrote ${markdownPath}`);
