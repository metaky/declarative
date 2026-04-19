import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { buildVariationPrompt, systemInstruction } from '../services/translationPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');

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
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running the variation prompt comparison.');
  process.exit(1);
}

const evalPath = path.join(repoRoot, 'evals', 'variation-prompt-set.json');
const promptSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const resultsDir = path.join(repoRoot, 'evals', 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const ai = new GoogleGenAI({ apiKey });
const modelId = 'gemini-2.5-flash';

const VARIATION_KIND_LABELS = {
  shorter: 'Shorter',
  longer: 'Longer',
  warmer: 'Warmer',
  more_straightforward: 'More straightforward',
  more_playful: 'More playful',
};

function getVariationKinds(useFewerWords) {
  return useFewerWords
    ? ['longer', 'warmer', 'more_straightforward', 'more_playful']
    : ['shorter', 'longer', 'warmer', 'more_straightforward', 'more_playful'];
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function openingKey(text) {
  return normalizeText(text).split(/\s+/).slice(0, 3).join(' ');
}

function jaccardSimilarity(left, right) {
  const leftSet = new Set(normalizeText(left).split(/\s+/).filter(Boolean));
  const rightSet = new Set(normalizeText(right).split(/\s+/).filter(Boolean));

  if (leftSet.size === 0 || rightSet.size === 0) return 0;

  const intersection = [...leftSet].filter((word) => rightSet.has(word)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return Number((intersection / union).toFixed(2));
}

function computeHeuristics(sourceTranslation, translations) {
  const sourceWordCount = countWords(sourceTranslation);

  return translations.map((item, index) => ({
    index,
    translation: item.translation,
    wordCount: countWords(item.translation),
    wordCountDeltaVsSource: countWords(item.translation) - sourceWordCount,
    openingKey: openingKey(item.translation),
    exactDuplicateWithSource: normalizeText(item.translation) === normalizeText(sourceTranslation),
    similarityToSource: jaccardSimilarity(sourceTranslation, item.translation),
  }));
}

function computePairHeuristics(translations) {
  if (translations.length < 2) {
    return {
      pairSimilarity: null,
      sameOpening: false,
      exactDuplicatePair: false,
    };
  }

  return {
    pairSimilarity: jaccardSimilarity(translations[0].translation, translations[1].translation),
    sameOpening: openingKey(translations[0].translation) === openingKey(translations[1].translation),
    exactDuplicatePair: normalizeText(translations[0].translation) === normalizeText(translations[1].translation),
  };
}

async function runVariation(promptCase, variationKind) {
  const prompt = buildVariationPrompt({
    text: promptCase.text,
    sourceTranslation: promptCase.sourceTranslation,
    variationKind,
    tone: promptCase.tone,
    interest: promptCase.interest,
    useFewerWords: promptCase.useFewerWords,
  });

  const startedAt = Date.now();

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingBudget: 0,
      },
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
  });

  let translations;
  try {
    translations = JSON.parse(response.text.trim());
  } catch (error) {
    translations = [];
  }

  const heuristics = computeHeuristics(promptCase.sourceTranslation, translations);
  const pairHeuristics = computePairHeuristics(translations);

  return {
    variationKind,
    label: VARIATION_KIND_LABELS[variationKind],
    durationMs: Date.now() - startedAt,
    prompt,
    usageMetadata: response.usageMetadata ?? null,
    translations,
    heuristics,
    pairHeuristics,
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
  lines.push('# Variation Prompt Review');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('This report reviews one-tap variation prompt quality using **Gemini 2.5 Flash**. It is designed for human review before shipping the feature.');
  lines.push('');
  lines.push('## Review Guidance');
  lines.push('');
  lines.push('- Use [variation-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/variation-quality-rubric.md) while reviewing.');
  lines.push('- A variation only earns its place if it gives the user a meaningfully different and still usable line.');
  lines.push('- Treat task loss, tonal drift, or near-duplicates as blockers.');
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
    lines.push(`- Source translation: ${result.sourceTranslation}`);
    lines.push(`- Review focus: ${result.reviewFocus.join('; ')}`);
    lines.push('');

    for (const output of result.outputs) {
      lines.push(`### ${output.label}`);
      lines.push('');
      lines.push(`- Duration: ${output.durationMs} ms`);
      lines.push(`- Usage: ${formatUsage(output.usageMetadata)}`);
      if (output.pairHeuristics.pairSimilarity !== null) {
        lines.push(`- Pair similarity: ${output.pairHeuristics.pairSimilarity}`);
        lines.push(`- Same opening: ${output.pairHeuristics.sameOpening ? 'Yes' : 'No'}`);
        lines.push(`- Exact duplicate pair: ${output.pairHeuristics.exactDuplicatePair ? 'Yes' : 'No'}`);
      }
      lines.push('');

      if (output.translations.length === 0) {
        lines.push('_No valid JSON translations parsed from the response._');
      } else {
        output.translations.forEach((item, index) => {
          const heuristic = output.heuristics[index];
          lines.push(`${index + 1}. ${item.translation}`);
          lines.push(`   - Word count delta vs source: ${heuristic.wordCountDeltaVsSource}`);
          lines.push(`   - Opening key: ${heuristic.openingKey}`);
          lines.push(`   - Similarity to source: ${heuristic.similarityToSource}`);
          lines.push(`   - Exact duplicate with source: ${heuristic.exactDuplicateWithSource ? 'Yes' : 'No'}`);
        });
      }
      lines.push('');
      lines.push('```txt');
      lines.push(`Variation kind verdict (${output.label}): Pass / Borderline / Fail`);
      lines.push('What worked:');
      lines.push('- ');
      lines.push('What felt too close to the source:');
      lines.push('- ');
      lines.push('What drifted or felt risky:');
      lines.push('- ');
      lines.push('Ship judgment for this case:');
      lines.push('- Accept / Borderline / Needs another prompt iteration');
      lines.push('```');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const startedAt = Date.now();
  console.log(`Running ${promptSet.length} variation prompt cases...`);

  const results = [];
  for (const promptCase of promptSet) {
    console.log(`- ${promptCase.id}`);
    const variationKinds = getVariationKinds(promptCase.useFewerWords);
    const outputs = [];

    for (const variationKind of variationKinds) {
      outputs.push(await runVariation(promptCase, variationKind));
    }

    results.push({
      ...promptCase,
      outputs,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `variation-prompt-review-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `variation-prompt-review-${timestamp}.md`);
  const latestJsonPath = path.join(resultsDir, 'latest-variation-prompt-review.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-variation-prompt-review.md');

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(markdownPath, buildMarkdown(results, timestamp));
  fs.writeFileSync(latestJsonPath, JSON.stringify(results, null, 2));
  fs.writeFileSync(latestMarkdownPath, buildMarkdown(results, timestamp));

  console.log('');
  console.log(`Wrote JSON results to ${jsonPath}`);
  console.log(`Wrote Markdown review report to ${markdownPath}`);
  console.log(`Updated latest JSON at ${latestJsonPath}`);
  console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
  console.log(`Completed in ${Date.now() - startedAt} ms`);
}

main().catch((error) => {
  console.error('Variation prompt review failed:', error);
  process.exit(1);
});
