import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  VALID_VERDICTS,
  applyCalibratedDecision,
  normalizeVerdict,
} from './evaluator-calibration-utils.mjs';
import {
  DEFAULT_EVALUATOR_MODEL,
  evaluateTranslationSet,
} from './translation-set-evaluator.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const inputPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const resultsDir = path.join(repoRoot, 'evals', 'results');
const modelId = DEFAULT_EVALUATOR_MODEL;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && !process.env[key]) {
      process.env[key] = valueParts.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running this evaluation.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
function loadCalibration() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing ${inputPath}. Run npm run quality:calibration-set first.`);
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function formatCounts(items, selector) {
  const counts = items.reduce((memo, item) => {
    const verdict = normalizeVerdict(selector(item)) ?? 'Unknown';
    memo[verdict] = (memo[verdict] ?? 0) + 1;
    return memo;
  }, {});
  return `Pass ${counts.Pass ?? 0}, Borderline ${counts.Borderline ?? 0}, Fail ${counts.Fail ?? 0}, Unknown ${counts.Unknown ?? 0}`;
}

function renderMarkdown(rows, timestamp) {
  const comparable = rows.filter((row) => VALID_VERDICTS.has(row.humanVerdict) && VALID_VERDICTS.has(row.calibratedVerdict));
  const agreements = comparable.filter((row) => row.humanVerdict === row.calibratedVerdict);
  const disagreements = comparable.filter((row) => row.humanVerdict !== row.calibratedVerdict);
  const exactAgreement = comparable.length ? Math.round((agreements.length / comparable.length) * 100) : 0;
  const postprocessedComparable = rows.filter((row) => VALID_VERDICTS.has(row.humanVerdict) && VALID_VERDICTS.has(row.postprocessedVerdict));
  const postprocessedAgreements = postprocessedComparable.filter((row) => row.humanVerdict === row.postprocessedVerdict);
  const postprocessedDisagreements = postprocessedComparable.filter((row) => row.humanVerdict !== row.postprocessedVerdict);
  const postprocessedAgreement = postprocessedComparable.length ? Math.round((postprocessedAgreements.length / postprocessedComparable.length) * 100) : 0;
  const priorComparable = rows.filter((row) => VALID_VERDICTS.has(row.humanVerdict) && VALID_VERDICTS.has(row.priorAutomatedVerdict));
  const priorAgreements = priorComparable.filter((row) => row.humanVerdict === row.priorAutomatedVerdict);
  const priorAgreement = priorComparable.length ? Math.round((priorAgreements.length / priorComparable.length) * 100) : 0;
  const totalInputTokens = rows.reduce((sum, row) => sum + (row.usageMetadata?.promptTokenCount ?? 0), 0);
  const totalOutputTokens = rows.reduce((sum, row) => sum + (row.usageMetadata?.candidatesTokenCount ?? 0), 0);

  const lines = [];
  lines.push('# Calibrated Evaluator Check');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('This check re-scores the 40 human-labeled calibration sets without regenerating translations.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Model: ${modelId}`);
  lines.push(`- Sets re-scored: ${rows.length}`);
  lines.push(`- Prior automated agreement on comparable rows: ${priorAgreements.length}/${priorComparable.length} (${priorAgreement}%)`);
  lines.push(`- Raw calibrated evaluator agreement: ${agreements.length}/${comparable.length} (${exactAgreement}%)`);
  lines.push(`- Postprocessed calibrated agreement: ${postprocessedAgreements.length}/${postprocessedComparable.length} (${postprocessedAgreement}%)`);
  lines.push(`- Calibrated verdicts: ${formatCounts(rows, (row) => row.calibratedVerdict)}`);
  lines.push(`- Postprocessed verdicts: ${formatCounts(rows, (row) => row.postprocessedVerdict)}`);
  lines.push(`- Human verdicts: ${formatCounts(rows, (row) => row.humanVerdict)}`);
  lines.push(`- Token use for this evaluator check: prompt ${totalInputTokens}, output ${totalOutputTokens}`);
  lines.push('');
  lines.push('## Remaining Disagreements');
  lines.push('');
  if (!postprocessedDisagreements.length) {
    lines.push('No remaining disagreements.');
  } else {
    for (const row of postprocessedDisagreements.slice(0, 20)) {
      lines.push(`### ${row.id}`);
      lines.push('');
      lines.push(`- Human: ${row.humanVerdict}`);
      lines.push(`- Raw calibrated evaluator: ${row.calibratedVerdict}`);
      lines.push(`- Postprocessed calibrated evaluator: ${row.postprocessedVerdict}`);
      lines.push(`- Prior automated: ${row.priorAutomatedVerdict ?? 'n/a'}`);
      lines.push(`- Tone: ${row.tone}; Fewer Words: ${row.useFewerWords ? 'On' : 'Off'}`);
      lines.push(`- Human note: ${row.humanNote || '(none)'}`);
      lines.push(`- Evaluator recommendation: ${row.evaluation?.recommendation || '(none)'}`);
      if (row.postprocessReasons?.length) lines.push(`- Postprocess reasons: ${row.postprocessReasons.join('; ')}`);
      lines.push('');
    }
  }
  lines.push('');
  lines.push('## All Re-Scored Rows');
  lines.push('');
  lines.push('| Item | Human | Raw Calibrated | Postprocessed | Prior Automated | Best Options | Excellent | Should-Not-Show | Serious Mismatch |');
  lines.push('|---|---|---|---|---|---:|---:|---:|---:|');
  for (const row of rows) {
    const summary = row.evaluation?.setSummary ?? {};
    lines.push(`| ${row.id} | ${row.humanVerdict ?? 'n/a'} | ${row.calibratedVerdict ?? 'n/a'} | ${row.postprocessedVerdict ?? 'n/a'} | ${row.priorAutomatedVerdict ?? 'n/a'} | ${summary.bestOptionCount ?? 'n/a'} | ${summary.excellentOptionCount ?? 'n/a'} | ${summary.shouldNotShowOptionCount ?? 'n/a'} | ${summary.seriousMismatchOptionCount ?? 'n/a'} |`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  fs.mkdirSync(resultsDir, { recursive: true });
  const rebuildLatest = process.argv.includes('--rebuild-latest');
  if (rebuildLatest) {
    const latestJsonPath = path.join(resultsDir, 'latest-calibrated-evaluator-check.json');
    const rows = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8')).map((row) => {
      const postprocess = applyCalibratedDecision(row);
      return {
        ...row,
        postprocessedVerdict: postprocess.verdict,
        postprocessReasons: postprocess.reasons,
      };
    });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdown = renderMarkdown(rows, timestamp);
    const markdownPath = path.join(resultsDir, `calibrated-evaluator-check-${timestamp}.md`);
    const latestMarkdownPath = path.join(resultsDir, 'latest-calibrated-evaluator-check.md');
    fs.writeFileSync(latestJsonPath, JSON.stringify(rows, null, 2));
    fs.writeFileSync(markdownPath, markdown);
    fs.writeFileSync(latestMarkdownPath, markdown);
    console.log(`Rebuilt Markdown report at ${markdownPath}`);
    console.log(`Updated latest JSON at ${latestJsonPath}`);
    console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
    return;
  }

  const calibration = loadCalibration();
  const items = (calibration.items ?? []).filter((item) => VALID_VERDICTS.has(normalizeVerdict(item.review?.setVerdict)));
  const rows = [];

  console.log(`Re-scoring ${items.length} human calibration sets with ${modelId}...`);
  for (const item of items) {
    console.log(`- ${item.id}`);
    const { evaluation, usageMetadata } = await evaluateTranslationSet(ai, item);
    const calibratedVerdict = normalizeVerdict(evaluation?.setSummary?.setVerdict ?? evaluation?.verdict);
    const baseRow = {
      id: item.id,
      text: item.text,
      tone: item.tone,
      interest: item.interest,
      interestMissing: item.tone === 'Interest Based' && !item.interest,
      useFewerWords: item.useFewerWords,
      humanVerdict: normalizeVerdict(item.review?.setVerdict),
      priorAutomatedVerdict: normalizeVerdict(item.automatedVerdict),
      humanNote: item.review?.why ?? '',
      translations: item.translations,
      evaluation,
      calibratedVerdict,
      usageMetadata,
    };
    const postprocess = applyCalibratedDecision(baseRow);
    rows.push({
      ...baseRow,
      postprocessedVerdict: postprocess.verdict,
      postprocessReasons: postprocess.reasons,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `calibrated-evaluator-check-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `calibrated-evaluator-check-${timestamp}.md`);
  const latestJsonPath = path.join(resultsDir, 'latest-calibrated-evaluator-check.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-calibrated-evaluator-check.md');
  const markdown = renderMarkdown(rows, timestamp);

  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(latestJsonPath, JSON.stringify(rows, null, 2));
  fs.writeFileSync(latestMarkdownPath, markdown);

  console.log(`Wrote JSON results to ${jsonPath}`);
  console.log(`Wrote Markdown report to ${markdownPath}`);
  console.log(`Updated latest JSON at ${latestJsonPath}`);
  console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
