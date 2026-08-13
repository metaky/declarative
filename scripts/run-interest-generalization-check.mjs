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
  parseCliOptions,
  resolveCanonicalSpendLedgerPath,
  runBudgetedCall,
} from './gemini-migration-eval-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const resultsDir = path.join(repoRoot, 'evals', 'results', 'gemini-migration');
const options = parseCliOptions(process.argv.slice(2));
if (options.configurations.length !== 1) {
  throw new Error('Interest generalization migration checks require exactly one explicit --configuration.');
}
const configuration = options.configurations[0];
const ledgerPath = await resolveCanonicalSpendLedgerPath({
  repoRoot,
  requestedPath: options.ledgerPath ?? CANONICAL_SPEND_LEDGER_RELATIVE_PATH,
});

const DEFAULT_INTERESTS = ['Minecraft', 'trains', 'Disney'];
const DEFAULT_INPUTS = [
  {
    id: 'running-house',
    text: 'Stop running in the house',
  },
  {
    id: 'dinner-hands',
    text: "Please come down and wash your hands. It's dinner time.",
  },
  {
    id: 'toys-upstairs',
    text: 'Pick up your toys and put them away upstairs in your room',
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

function getArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
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

function wordCount(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

const POKEMON_SPECIFIC_TERMS = /\b(?:pokemon|poke[ -]?stop|trainer|squirtle|pikachu|eevee|ditto|gym)\b/i;

function findCrossInterestLeaks(results) {
  return results.flatMap((result) => {
    if (String(result.interest).trim().toLowerCase() === 'pokemon') return [];
    return result.translations
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => POKEMON_SPECIFIC_TERMS.test(item.translation))
      .map(({ item, index }) => ({
        interest: result.interest,
        inputId: result.inputId,
        optionIndex: index + 1,
        translation: item.translation,
      }));
  });
}

async function generate(ai, interest, input, useFewerWords) {
  const prompt = buildTranslationPrompt({
    text: input.text,
    tone: 'Interest Based',
    interest,
    useFewerWords,
    existingTranslations: [],
  });
  const startedAt = Date.now();
  const response = await runBudgetedCall({
    repoRoot,
    ledgerPath,
    budgetUsd: options.budgetUsd,
    type: 'generation',
    runId: `${configuration.id}:${interest}:${input.id}:fewer-${useFewerWords}`,
    configuration,
    tokenLimits: MIGRATION_TOKEN_LIMITS.generation,
    request: {
      model: configuration.model,
      contents: prompt,
      config: {
        maxOutputTokens: MIGRATION_TOKEN_LIMITS.generation.maxOutputTokens,
        systemInstruction,
        thinkingConfig: buildThinkingConfig(configuration),
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
    call: (request) => ai.models.generateContent(request),
    serializeResult: (value) => ({
      text: value.text,
      usageMetadata: value.usageMetadata,
      candidates: value.candidates,
    }),
  });

  const translations = parseJsonArray(response.text)
    .filter((item) => item?.translation)
    .map((item) => ({
      translation: String(item.translation).trim(),
      wordCount: wordCount(item.translation),
    }));

  return {
    interest,
    inputId: input.id,
    text: input.text,
    useFewerWords,
    durationMs: Date.now() - startedAt,
    effectiveConfiguration: captureConfigurationMetadata(configuration),
    usageMetadata: response.usageMetadata ?? null,
    generationUsd: calculateUsageCost(configuration, response.usageMetadata),
    translations,
  };
}

function renderMarkdown(payload) {
  const lines = [
    '# Interest Generalization Check',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `Model: ${payload.model}. Tone: Interest Based. Fewer Words: ${payload.useFewerWords ? 'on' : 'off'}.`,
    '',
  ];

  for (const result of payload.results) {
    lines.push(`## ${result.interest} / ${result.inputId}`);
    lines.push('');
    lines.push(`Original: ${result.text}`);
    lines.push('');
    result.translations.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.translation}`);
    });
    lines.push('');
  }

  if (payload.validation?.crossInterestLeaks?.length) {
    lines.push('## Validation Issues');
    lines.push('');
    for (const issue of payload.validation.crossInterestLeaks) {
      lines.push(`- ${issue.interest} / ${issue.inputId} option ${issue.optionIndex}: ${issue.translation}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

loadEnv();
const apiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running this check.');
  process.exit(1);
}

const interests = getArg('interests')
  ? getArg('interests').split(',').map((item) => item.trim()).filter(Boolean)
  : DEFAULT_INTERESTS;
const useFewerWords = process.argv.includes('--fewer');
const ai = new GoogleGenAI({ apiKey });

const results = [];
for (const interest of interests) {
  for (const input of DEFAULT_INPUTS) {
    console.log(`- ${interest}: ${input.id}`);
    results.push(await generate(ai, interest, input, useFewerWords));
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  model: configuration.model,
  effectiveConfiguration: captureConfigurationMetadata(configuration),
  tone: 'Interest Based',
  useFewerWords,
  interests,
  inputs: DEFAULT_INPUTS,
  results,
  validation: {
    crossInterestLeaks: findCrossInterestLeaks(results),
  },
};

fs.mkdirSync(resultsDir, { recursive: true });
const artifactPaths = buildArtifactPaths({ resultsDir, baseName: 'interest-generalization' });

fs.writeFileSync(artifactPaths.json, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(artifactPaths.latestJson, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(artifactPaths.markdown, renderMarkdown(payload));
fs.writeFileSync(artifactPaths.latestMarkdown, renderMarkdown(payload));

console.log(`Wrote ${artifactPaths.markdown}`);

if (payload.validation.crossInterestLeaks.length > 0) {
  console.error(`Found ${payload.validation.crossInterestLeaks.length} cross-interest leak(s).`);
  process.exit(1);
}
