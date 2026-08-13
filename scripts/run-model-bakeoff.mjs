import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildThinkingConfig,
  listEvaluationConfigurations,
} from '../services/geminiConfig.js';
import {
  buildTranslationPrompt,
  buildVariationPrompt,
  systemInstruction,
} from '../services/translationPrompt.js';
import {
  applyCalibratedDecision,
  normalizeVerdict,
} from './evaluator-calibration-utils.mjs';
import { evaluateTranslationSet } from './translation-set-evaluator.mjs';
import {
  buildArtifactPaths,
  buildEvaluationPlan,
  calculateAggregateGates,
  calculateAggregateMetrics,
  calculateUsageCost,
  captureConfigurationMetadata,
  loadEnvFile,
  loadMigrationCorpus,
  parseCliOptions,
  readSpendLedger,
  runBudgetedCall,
} from './gemini-migration-eval-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const calibrationPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const historicalResultsDir = path.join(repoRoot, 'evals', 'results');
const migrationResultsDir = path.join(historicalResultsDir, 'gemini-migration');
const defaultCorpusPath = path.join(repoRoot, 'evals', 'gemini-migration-prompt-set.json');
const defaultSpendLedgerPath = path.join(migrationResultsDir, 'phase-3-spend.json');
const MAX_CALL_RESERVATION_USD = 1;

const MODEL_CANDIDATES = listEvaluationConfigurations();

function normalizeBakeoffPayloadForCurrentRegistry(payload) {
  const currentIds = new Set(MODEL_CANDIDATES.map((candidate) => candidate.id));
  return {
    ...payload,
    candidates: MODEL_CANDIDATES,
    results: (payload.results ?? []).filter((result) => currentIds.has(result.candidateId)),
  };
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const HELP = `Gemini migration model bakeoff

Usage:
  node scripts/run-model-bakeoff.mjs --configurations=<id,id|all> [options]

Required migration options:
  --configurations=...   Explicit allow-listed configuration IDs (or "all")

Options:
  --corpus=<path>        Corpus manifest (default: evals/gemini-migration-prompt-set.json)
  --repeats=<n>          Repetitions per case/configuration (default: 1)
  --limit=<n>            Limit corpus cases before expansion
  --seed=<integer>       Deterministic plan seed (default: 20260813)
  --phase-budget-usd=<n> Cumulative Phase 3 cap, maximum 10 (default: 10)
  --spend-ledger=<path>  Persistent cumulative spend ledger
  --score                 Explicitly run the automated evaluator
  --help                  Show this help without loading credentials or calling Gemini

Approved IDs:
  gemini-2.5-flash-baseline
  gemini-3.5-flash-lite-minimal
  gemini-3.6-flash-minimal
  gemini-3.6-flash-medium
`;

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

function buildRunPrompt(testCase, run, existingTranslations) {
  if (run.operation === 'variation') {
    return buildVariationPrompt({
      text: testCase.text,
      sourceTranslation: testCase.sourceTranslation,
      variationKind: run.variationKind,
      tone: testCase.tone,
      interest: testCase.interest,
      useFewerWords: testCase.useFewerWords,
    });
  }
  return buildTranslationPrompt({
    ...testCase,
    existingTranslations: run.operation === 'moreIdeas'
      ? existingTranslations
      : (testCase.existingTranslations ?? []),
  });
}

function responseSafetyFlags(response) {
  return (response?.candidates ?? [])
    .map(({ finishReason }) => finishReason)
    .filter((finishReason) => finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason));
}

function parseTranslations(responseText, operation) {
  const raw = String(responseText ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { translations: [], parseError: true, contractError: false };
  }
  if (!Array.isArray(parsed)) {
    return { translations: [], parseError: false, contractError: true };
  }
  const valid = parsed.every((item) => (
    item
    && typeof item === 'object'
    && Object.keys(item).length === 1
    && typeof item.translation === 'string'
    && item.translation.trim()
  ));
  const expectedCount = operation === 'variation'
    ? parsed.length === 2
    : parsed.length >= 3 && parsed.length <= 4;
  if (!valid || !expectedCount) {
    return { translations: [], parseError: false, contractError: true };
  }
  return {
    translations: addWordCounts(parsed.map(({ translation }) => ({ translation: translation.trim() }))),
    parseError: false,
    contractError: false,
  };
}

function findInterestLeakage(testCase, translations) {
  if (!testCase.interest) return false;
  const otherInterestTerms = ['minecraft', 'train', 'disney', 'pokemon', 'pokémon', 'dinosaur', 'cooking']
    .filter((term) => !String(testCase.interest).toLowerCase().includes(term));
  const pattern = new RegExp(`\\b(?:${otherInterestTerms.join('|')})\\b`, 'i');
  return translations.some(({ translation }) => pattern.test(translation));
}

async function generate(ai, candidate, testCase, run, options) {
  const existingTranslations = options.existingTranslations ?? [];
  const prompt = buildRunPrompt(testCase, run, existingTranslations);
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
    runId: run.runId,
    candidateId: candidate.id,
    model: candidate.model,
    thinkingConfig: config.thinkingConfig,
    caseId: testCase.id,
    operation: run.operation,
    variationKind: run.variationKind,
    round: run.round,
    repeat: run.repeat,
    tone: testCase.tone,
    interest: testCase.interest,
    useFewerWords: Boolean(testCase.useFewerWords),
    provenance: testCase.provenance,
    isCalibrationCase: testCase.provenance?.some(({ source }) => source === 'evals/human-calibration-set.json') ?? false,
  };

  try {
    const response = await runBudgetedCall({
      ledgerPath: options.ledgerPath,
      budgetUsd: options.budgetUsd,
      type: 'generation',
      estimatedUsd: MAX_CALL_RESERVATION_USD,
      call: () => ai.models.generateContent({
        model: candidate.model,
        contents: prompt,
        config,
      }),
      actualUsd: (value) => calculateUsageCost(candidate, value.usageMetadata),
    });
    const parsed = parseTranslations(response.text, run.operation);
    const generationUsd = calculateUsageCost(candidate, response.usageMetadata);

    return {
      ...baseResult,
      status: 'success',
      durationMs: Date.now() - startedAt,
      usageMetadata: response.usageMetadata ?? null,
      estimatedUsd: generationUsd,
      generationUsd,
      evaluatorUsd: 0,
      safetyFlags: responseSafetyFlags(response),
      ...parsed,
      fewerWordsCompliant: testCase.useFewerWords
        ? parsed.translations.every(({ wordCount }) => wordCount <= 12)
        : null,
      interestLeakage: findInterestLeakage(testCase, parsed.translations),
      interestGrounded: null,
    };
  } catch (error) {
    if (/Phase 3 budget stop/i.test(error instanceof Error ? error.message : String(error))) throw error;
    return {
      ...baseResult,
      status: 'error',
      durationMs: Date.now() - startedAt,
      usageMetadata: null,
      estimatedUsd: 0,
      generationUsd: 0,
      evaluatorUsd: 0,
      translations: [],
      parseError: false,
      contractError: false,
      safetyFlags: [],
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

async function scoreResults(ai, payload, options) {
  const rows = [];
  const evaluatorConfiguration = MODEL_CANDIDATES.find(({ id }) => id === 'gemini-2.5-flash-baseline');
  for (const result of payload.results) {
    const testCase = getCaseById(payload, result.caseId);
    const excludedFromAggregate = shouldExcludeFromAggregate(testCase);
    const aggregateExclusionReason = excludedFromAggregate
      ? 'Guardrail case only: production blocks Interest Based requests without an entered interest.'
      : null;

    if (result.localOnly || result.error || result.parseError || result.contractError || !result.translations?.length) {
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
    const { evaluation, usageMetadata, evaluatorModel } = await runBudgetedCall({
      ledgerPath: options.ledgerPath,
      budgetUsd: options.budgetUsd,
      type: 'evaluation',
      estimatedUsd: MAX_CALL_RESERVATION_USD,
      call: () => evaluateTranslationSet(ai, evaluationInput),
      actualUsd: (value) => calculateUsageCost(evaluatorConfiguration, value.usageMetadata),
    });
    const calibratedVerdict = normalizeVerdict(evaluation?.setSummary?.setVerdict ?? evaluation?.verdict);
    const evaluatorUsd = calculateUsageCost(evaluatorConfiguration, usageMetadata);
    const shouldNotShowCount = evaluation?.setSummary?.shouldNotShowOptionCount ?? 0;
    const safetyFlags = [
      ...(result.safetyFlags ?? []),
      ...Array.from({ length: shouldNotShowCount }, () => 'EVALUATOR_SHOULD_NOT_SHOW'),
    ];
    const scoredRow = {
      ...result,
      translations: evaluationInput.translations,
      qualityEvaluation: evaluation,
      rawCalibratedVerdict: calibratedVerdict,
      evaluatorUsageMetadata: usageMetadata,
      evaluatorModel,
      evaluatorUsd,
      safetyFlags,
      interestGrounded: result.interest
        ? (evaluation?.setSummary?.seriousMismatchOptionCount ?? 0) === 0
        : null,
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
  lines.push('Exact effective configuration metadata:');
  for (const candidate of payload.candidates) {
    lines.push(`- ${candidate.id}: \`${JSON.stringify(captureConfigurationMetadata(candidate))}\``);
  }
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Candidate | Runs | Aggregate Runs | Excluded | Errors | Avg Latency ms | Prompt Tokens | Visible Candidate Tokens | Thought Tokens | Billed Output Tokens (Candidates + Thoughts) | Estimated USD | Postprocessed Verdicts | Avg Usable | Avg Excellent | Should-Not-Show | Median ms | p95 ms | Total Tokens | Cost / Successful Request USD | Evaluator USD | Total Gen + Eval USD | Parse Errors | Contract Errors | Safety Flags |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const summary of payload.summary) {
    lines.push(`| ${summary.candidateId} | ${summary.runs} | ${summary.aggregateRuns ?? summary.runs} | ${summary.excludedFromAggregate ?? 0} | ${summary.errors ?? 0} | ${summary.avgLatencyMs} | ${summary.promptTokens} | ${summary.candidateOutputTokens} | ${summary.thoughtTokens} | ${summary.billedOutputTokens} | ${summary.estimatedUsd} | ${summary.postprocessedVerdicts ?? 'not scored'} | ${summary.avgUsableOptions ?? 'n/a'} | ${summary.avgExcellentOptions ?? 'n/a'} | ${summary.shouldNotShowOptions ?? 'n/a'} | ${summary.medianLatencyMs ?? 0} | ${summary.p95LatencyMs ?? 0} | ${summary.totalTokens ?? 0} | ${summary.costPerSuccessfulRequestUsd ?? 0} | ${summary.evaluatorUsd ?? 0} | ${summary.totalGenerationAndEvaluationUsd ?? summary.estimatedUsd} | ${summary.parseErrors ?? 0} | ${summary.contractErrors ?? 0} | ${summary.safetyFlags ?? 0} |`);
  }
  lines.push('');
  lines.push(`Aggregate counts and gates: ${JSON.stringify(payload.aggregate ?? {})}`);
  lines.push(`Per-repeat automated gates: ${JSON.stringify(payload.gates ?? [])}`);
  lines.push(`Local-only guardrails: ${payload.localChecks?.length ?? 0}; model/evaluator calls: 0.`);
  if (payload.cumulativeSpend) {
    lines.push(`Cumulative Phase 3 smoke-plus-full spend: generation $${payload.cumulativeSpend.generation.spendUsd}; evaluation $${payload.cumulativeSpend.evaluation.spendUsd}; total $${payload.cumulativeSpend.totalSpendUsd} of $${payload.cumulativeSpend.budgetUsd}.`);
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
    lines.push(`- Run: ${result.runId ?? 'historical'}; operation ${result.operation ?? 'translation'}; repeat ${result.repeat ?? 1}${result.round ? `; More Ideas round ${result.round}` : ''}${result.variationKind ? `; variation ${result.variationKind}` : ''}`);
    const candidateOutputTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    const thoughtTokens = result.usageMetadata?.thoughtsTokenCount ?? 0;
    lines.push(`- Tokens: prompt ${result.usageMetadata?.promptTokenCount ?? 0}; visible candidates ${candidateOutputTokens}; thoughts ${thoughtTokens}; billed output (candidates + thoughts) ${candidateOutputTokens + thoughtTokens}`);
    lines.push(`- Estimated USD: ${result.estimatedUsd}`);
    lines.push(`- Evaluator USD: ${result.evaluatorUsd ?? 0}; total generation + evaluation USD: ${Number(((result.generationUsd ?? result.estimatedUsd ?? 0) + (result.evaluatorUsd ?? 0)).toFixed(6))}`);
    lines.push(`- Parse error: ${Boolean(result.parseError)}; contract error: ${Boolean(result.contractError)}; safety flags: ${(result.safetyFlags ?? []).join(', ') || 'none'}`);
    if (result.useFewerWords) lines.push(`- Fewer Words compliance: ${result.fewerWordsCompliant ?? 'not scored'}`);
    if (result.interest) lines.push(`- Interest leakage: ${result.interestLeakage ?? 'not scored'}; grounding: ${result.interestGrounded ?? 'not scored'}`);
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
    const aggregateMetrics = calculateAggregateMetrics(aggregateItems.map((item) => ({
      ...item,
      status: item.status ?? (item.error ? 'error' : 'success'),
      generationUsd: item.generationUsd ?? item.estimatedUsd ?? 0,
    })));
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
      medianLatencyMs: aggregateMetrics.latencyMs.median,
      p95LatencyMs: aggregateMetrics.latencyMs.p95,
      promptTokens: sum((item) => item.usageMetadata?.promptTokenCount ?? 0),
      candidateOutputTokens: sum((item) => item.usageMetadata?.candidatesTokenCount ?? 0),
      thoughtTokens: sum((item) => item.usageMetadata?.thoughtsTokenCount ?? 0),
      billedOutputTokens: sum((item) => (item.usageMetadata?.candidatesTokenCount ?? 0) + (item.usageMetadata?.thoughtsTokenCount ?? 0)),
      totalTokens: sum((item) => item.usageMetadata?.totalTokenCount ?? 0),
      estimatedUsd: Number(sum((item) => item.estimatedUsd).toFixed(6)),
      successfulRequestUsd: aggregateMetrics.spendUsd.successfulRequests,
      costPerSuccessfulRequestUsd: aggregateMetrics.spendUsd.costPerSuccessfulRequest,
      evaluatorUsd: aggregateMetrics.spendUsd.evaluator,
      totalGenerationAndEvaluationUsd: aggregateMetrics.spendUsd.generationAndEvaluation,
      parseErrors: aggregateMetrics.parseErrors,
      contractErrors: aggregateMetrics.contractErrors,
      safetyFlags: aggregateMetrics.safetyFlags,
      fewerWords: aggregateMetrics.fewerWords,
      interestChecks: aggregateMetrics.interest,
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
  if (hasFlag('help')) {
    console.log(HELP);
    process.exit(0);
  }

  if (hasFlag('rebuild-latest')) {
    const latestJsonPath = path.join(historicalResultsDir, 'latest-model-bakeoff.json');
    const latestMarkdownPath = path.join(historicalResultsDir, 'latest-model-bakeoff.md');
    const existingPayload = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
    const payload = normalizeBakeoffPayloadForCurrentRegistry(existingPayload);
    payload.summary = summarizeBakeoffResults(payload.results, payload.candidates);
    fs.writeFileSync(latestJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(latestMarkdownPath, renderBakeoffMarkdown(payload));
    console.log(`Updated latest JSON at ${latestJsonPath}`);
    console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
    process.exit(0);
  }

  const options = parseCliOptions(process.argv.slice(2));
  const corpusPath = path.resolve(repoRoot, options.corpus ?? defaultCorpusPath);
  const ledgerPath = path.resolve(repoRoot, options.ledgerPath ?? defaultSpendLedgerPath);
  const corpus = await loadMigrationCorpus(corpusPath);
  const cases = options.limit ? corpus.cases.slice(0, options.limit) : corpus.cases;
  const casesById = new Map(cases.map((item) => [item.id, item]));
  const candidatesById = new Map(options.configurations.map((item) => [item.id, item]));

  loadEnvFile(envPath);
  const apiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
  if (!apiKey) {
    console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running this bakeoff.');
    process.exit(1);
  }
  const ai = new GoogleGenAI({ apiKey });

  if (hasFlag('score-latest')) {
    const artifactPaths = buildArtifactPaths({ resultsDir: migrationResultsDir, baseName: 'model-bakeoff' });
    const existingPayload = JSON.parse(fs.readFileSync(artifactPaths.latestJson, 'utf8'));
    const selectedIds = new Set(options.configurations.map(({ id }) => id));
    let payload = {
      ...existingPayload,
      candidates: options.configurations,
      results: existingPayload.results.filter(({ candidateId }) => selectedIds.has(candidateId)),
    };
    payload = await scoreResults(ai, payload, { ledgerPath, budgetUsd: options.budgetUsd });
    payload.summary = summarizeBakeoffResults(payload.results, payload.candidates);
    payload.aggregate = calculateAggregateMetrics(payload.results);
    payload.gates = calculateAggregateGates(payload.results);
    payload.cumulativeSpend = await readSpendLedger(ledgerPath, options.budgetUsd);
    fs.mkdirSync(migrationResultsDir, { recursive: true });
    fs.writeFileSync(artifactPaths.json, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(artifactPaths.markdown, renderBakeoffMarkdown(payload));
    fs.writeFileSync(artifactPaths.latestJson, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(artifactPaths.latestMarkdown, renderBakeoffMarkdown(payload));
    console.log(`Wrote ${artifactPaths.markdown}`);
    process.exit(0);
  }

  const plan = buildEvaluationPlan({
    cases,
    configurations: options.configurations,
    repeats: options.repeats,
    seed: options.seed,
  });
  const results = [];
  const moreIdeasState = new Map();
  let stoppedBeforeCap = null;

  console.log(`Running migration bakeoff for ${cases.length} case(s), ${plan.calls.length} planned model call(s), and ${options.configurations.length} configuration(s).`);
  for (const run of plan.calls) {
    const candidate = candidatesById.get(run.configurationId);
    const testCase = casesById.get(run.caseId);
    const stateKey = `${run.configurationId}:${run.caseId}:repeat-${run.repeat}`;
    const existingTranslations = moreIdeasState.get(stateKey) ?? testCase.existingTranslations ?? [];
    console.log(`- ${run.runId}`);
    try {
      const result = await generate(ai, candidate, testCase, run, {
        ledgerPath,
        budgetUsd: options.budgetUsd,
        existingTranslations,
      });
      results.push(result);
      if (run.operation === 'moreIdeas' && result.translations.length) {
        moreIdeasState.set(stateKey, [...existingTranslations, ...result.translations]);
      }
    } catch (error) {
      stoppedBeforeCap = {
        runId: run.runId,
        reason: error instanceof Error ? error.message : String(error),
      };
      break;
    }
  }

  let payload = {
    generatedAt: new Date().toISOString(),
    sourceDocs: [
      'https://ai.google.dev/gemini-api/docs/models',
      'https://ai.google.dev/gemini-api/docs/pricing',
    ],
    corpus: {
      path: path.relative(repoRoot, corpusPath),
      seed: options.seed,
      importedCount: corpus.importedCount,
      totalCases: cases.length,
      provenance: corpus.imports,
    },
    repeats: options.repeats,
    plannedCalls: plan.calls.length,
    completedCalls: results.length,
    stoppedBeforeCap,
    candidates: options.configurations,
    effectiveConfigurations: options.configurations.map(captureConfigurationMetadata),
    cases,
    localChecks: plan.localChecks,
    qualityScored: false,
    results,
  };

  if (options.score && !stoppedBeforeCap) {
    try {
      payload = await scoreResults(ai, payload, { ledgerPath, budgetUsd: options.budgetUsd });
    } catch (error) {
      payload.stoppedBeforeCap = {
        stage: 'evaluation',
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
  payload.summary = summarizeBakeoffResults(payload.results, payload.candidates);
  payload.aggregate = calculateAggregateMetrics(payload.results);
  payload.gates = calculateAggregateGates(payload.results);
  payload.cumulativeSpend = await readSpendLedger(ledgerPath, options.budgetUsd);

  fs.mkdirSync(migrationResultsDir, { recursive: true });
  const artifactPaths = buildArtifactPaths({ resultsDir: migrationResultsDir, baseName: 'model-bakeoff' });
  fs.writeFileSync(artifactPaths.json, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(artifactPaths.markdown, renderBakeoffMarkdown(payload));
  fs.writeFileSync(artifactPaths.latestJson, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(artifactPaths.latestMarkdown, renderBakeoffMarkdown(payload));

  console.log(`Wrote ${artifactPaths.markdown}`);
}
