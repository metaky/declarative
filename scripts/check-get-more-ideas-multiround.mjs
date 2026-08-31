import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { buildThinkingConfig } from '../services/geminiConfig.js';
import { buildTranslationPrompt, systemInstruction } from '../services/translationPrompt.js';
import {
  CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  MIGRATION_TOKEN_LIMITS,
  buildArtifactPaths,
  calculateUsageCost,
  captureConfigurationMetadata,
  getProviderDurationMs,
  parseCliOptions,
  resolveCanonicalSpendLedgerPath,
  runBudgetedCall,
  writePrivateMigrationArtifactSet,
} from './gemini-migration-eval-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const evalPath = path.join(repoRoot, 'evals', 'get-more-ideas-prompt-set.json');
const resultsDir = path.join(repoRoot, 'evals', 'results', 'gemini-migration');
const rounds = 3;
let options;
let configuration;
let ledgerPath;
let promptSet;
let ai;

async function runRound(promptCase, existingTranslations, round) {
  const prompt = buildTranslationPrompt({
    text: promptCase.text,
    existingTranslations,
    tone: promptCase.tone,
    interest: promptCase.interest,
    useFewerWords: promptCase.useFewerWords,
  });

  const response = await runBudgetedCall({
    repoRoot,
    ledgerPath,
    budgetUsd: options.budgetUsd,
    type: 'generation',
    runId: `${configuration.id}:${promptCase.id}:round-${round}`,
    configuration,
    tokenLimits: MIGRATION_TOKEN_LIMITS.generation,
    request: {
      model: configuration.model,
      contents: prompt,
      config: {
        maxOutputTokens: MIGRATION_TOKEN_LIMITS.generation.maxOutputTokens,
        thinkingConfig: buildThinkingConfig(configuration),
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
      },
    },
    requestContext: {
      harnessVersion: 'task-6-request-v1',
      schemaVersion: 'translation-array-v1',
      corpusSourceIdentity: 'evals/get-more-ideas-prompt-set.json',
      caseId: promptCase.id,
      repeat: 1,
      direction: null,
      moreIdeasRound: round,
      operation: 'moreIdeas',
    },
    call: (request) => ai.models.generateContent(request),
    serializeResult: (value) => ({
      text: value.text,
      usageMetadata: value.usageMetadata,
      candidates: value.candidates,
    }),
  });

  let translations;
  try {
    translations = JSON.parse(response.text.trim());
  } catch (error) {
    translations = [];
  }

  return {
    durationMs: getProviderDurationMs(response),
    prompt,
    effectiveConfiguration: captureConfigurationMetadata(configuration),
    usageMetadata: response.usageMetadata ?? null,
    generationUsd: calculateUsageCost(configuration, response.usageMetadata),
    translations,
  };
}

function formatUsage(usageMetadata) {
  if (!usageMetadata) return 'No usage metadata returned.';
  return [
    `promptTokenCount: ${usageMetadata.promptTokenCount ?? 'n/a'}`,
    `candidatesTokenCount: ${usageMetadata.candidatesTokenCount ?? 'n/a'}`,
    `thoughtsTokenCount: ${usageMetadata.thoughtsTokenCount ?? 'n/a'}`,
    `totalTokenCount: ${usageMetadata.totalTokenCount ?? 'n/a'}`,
    `cachedContentTokenCount: ${usageMetadata.cachedContentTokenCount ?? 'n/a'}`,
  ].join(' | ');
}

function buildMarkdown(results, timestamp) {
  const lines = [];
  lines.push('# Get More Ideas Multi-Round Review');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('This report tests the current `Get more ideas` implementation across multiple rounds using **Gemini 2.5 Flash**. It is meant for human review of distinctness, completeness, tone fidelity, and whether later rounds stay useful.');
  lines.push('');
  lines.push('## Review Guidance');
  lines.push('');
  lines.push('- Review each round as if you were a real user clicking `Get more ideas` repeatedly.');
  lines.push('- Pay special attention to whether round 2 and round 3 still feel fresh rather than like softened rewrites of round 1.');
  lines.push('- Treat any loss of multi-part coverage, tone drift, or subtle pressure as a blocker.');
  lines.push('- Use [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md) for judging distinctness and usefulness.');
  lines.push('');

  for (const result of results) {
    lines.push(`## ${result.id} — ${result.label}`);
    lines.push('');
    lines.push(`- Tone: ${result.tone}`);
    lines.push(`- Fewer Words: ${result.useFewerWords ? 'Yes' : 'No'}`);
    if (result.interest) {
      lines.push(`- Interest: ${result.interest}`);
    }
    lines.push(`- Text: ${result.text}`);
    lines.push(`- Review focus: ${result.reviewFocus.join('; ')}`);
    lines.push('');

    result.rounds.forEach((round, index) => {
      lines.push(`### Round ${index + 1}`);
      lines.push('');
      lines.push(`- Existing translations sent: ${round.existingTranslationsCount}`);
      lines.push(`- Duration: ${round.durationMs} ms`);
      lines.push(`- Usage: ${formatUsage(round.usageMetadata)}`);
      lines.push('');
      if (round.translations.length === 0) {
        lines.push('_No valid JSON translations parsed from the response._');
      } else {
        round.translations.forEach((item, itemIndex) => {
          lines.push(`${itemIndex + 1}. ${item.translation}`);
        });
      }
      lines.push('');
    });

    lines.push('### Human Review Notes');
    lines.push('');
    lines.push('```txt');
    lines.push('Round quality:');
    lines.push('- Round 1: ');
    lines.push('- Round 2: ');
    lines.push('- Round 3: ');
    lines.push('');
    lines.push('Where freshness held up:');
    lines.push('- ');
    lines.push('');
    lines.push('Where quality softened or repeated:');
    lines.push('- ');
    lines.push('');
    lines.push('Decision for this case:');
    lines.push('- Accept / Borderline / Needs another iteration');
    lines.push('```');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export async function writeGetMoreIdeasArtifacts({ artifactPaths, payload, markdown }) {
  await writePrivateMigrationArtifactSet({ artifactPaths, payload, markdown });
}

async function main() {
  options = parseCliOptions(process.argv.slice(2));
  if (options.configurations.length !== 1) {
    throw new Error('Get More Ideas migration checks require exactly one explicit --configuration.');
  }
  configuration = options.configurations[0];
  ledgerPath = await resolveCanonicalSpendLedgerPath({
    repoRoot,
    requestedPath: options.ledgerPath ?? CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
  });
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
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running the multi-round follow-up comparison.');
  promptSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
  ai = new GoogleGenAI({ apiKey });

  const startedAt = Date.now();
  console.log(`Running ${promptSet.length} multi-round Get more ideas cases across ${rounds} rounds...`);

  const results = [];
  for (const promptCase of promptSet) {
    console.log(`- ${promptCase.id}`);
    const roundResults = [];
    let existingTranslations = [];

    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const roundResult = await runRound(promptCase, existingTranslations, roundIndex + 1);
      roundResults.push({
        ...roundResult,
        existingTranslationsCount: existingTranslations.length,
      });
      existingTranslations = [...existingTranslations, ...roundResult.translations];
    }

    results.push({
      ...promptCase,
      rounds: roundResults,
    });
  }

  const artifactPaths = buildArtifactPaths({ resultsDir, baseName: 'get-more-ideas-multiround' });
  const timestamp = new Date().toISOString();

  await writeGetMoreIdeasArtifacts({
    artifactPaths,
    payload: results,
    markdown: buildMarkdown(results, timestamp),
  });

  console.log('');
  console.log(`Wrote JSON results to ${artifactPaths.json}`);
  console.log(`Wrote Markdown review report to ${artifactPaths.markdown}`);
  console.log(`Updated latest JSON at ${artifactPaths.latestJson}`);
  console.log(`Updated latest Markdown at ${artifactPaths.latestMarkdown}`);
  console.log(`Completed in ${Date.now() - startedAt} ms`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log(`Gemini Get More Ideas multi-round comparison

Usage:
  node scripts/check-get-more-ideas-multiround.mjs --configuration=<id> [options]

Use one explicit allow-listed configuration. This help path does not load credentials or call Gemini.`);
    process.exit(0);
  }
  main().catch((error) => {
    console.error('Get more ideas multi-round review failed:', error);
    process.exit(1);
  });
}
