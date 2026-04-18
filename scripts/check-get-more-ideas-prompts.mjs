import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { buildTranslationPrompt, systemInstruction } from '../services/translationPrompt.js';

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
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running the follow-up prompt comparison.');
  process.exit(1);
}

const evalPath = path.join(repoRoot, 'evals', 'get-more-ideas-prompt-set.json');
const promptSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const resultsDir = path.join(repoRoot, 'evals', 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const ai = new GoogleGenAI({ apiKey });
const modelId = 'gemini-2.5-flash';

function buildProposedFollowUpAddition(existingTranslations) {
  const shownTranslations = existingTranslations.map((item) => item.translation).join(', ');

  return `\nThese earlier suggestions have already been shown to the user: ${shownTranslations}\n\nFirst, silently notice the main patterns already used in those earlier suggestions so you can avoid repeating them. Then write only the JSON answer.\n\nGenerate 4 new declarative alternatives that are genuinely different from the earlier suggestions in both angle and sentence shape, not just in wording.\nTreat the earlier suggestions as fully covered. Do not reuse their core sentence patterns, opening moves, or closing moves.\nAvoid obvious repeats, near-duplicates, shallow synonym swaps, and generic fallback phrasing.\n\nMake the 4 new suggestions intentionally different from each other:\n- Suggestion 1: foreground a concrete place, object, or visible setup in the situation.\n- Suggestion 2: foreground the sequence, path, or transition from one part to the next.\n- Suggestion 3: foreground a practical support or matter-of-fact piece of logistics that helps the moment move along.\n- Suggestion 4: foreground a calm shared perspective, but keep it natural and do not make it emotionally loaded.\n\nDo not let multiple suggestions use the same sentence skeleton.\nAvoid generic frames such as \"it's time for...\", \"X is ready\", \"X is next\", \"after that...\", \"it looks like...\", or \"I wonder...\" unless one appears once and feels unusually natural.\nUse different opening words for each suggestion.\n\nKeep every suggestion authentic, low-pressure, and useful in a real caregiver moment.\nDifferent must not mean more emotionally loaded, more praising, more performative, or more manipulative.\nIf the original request has multiple important parts, preserve all of them in every suggestion.\nStay grounded in the same real situation. Do not invent playful details, emotional stakes, or extra context just to make the lines feel new.`;
}

function buildPromptVariant(promptCase, variant) {
  if (variant === 'current') {
    return buildTranslationPrompt({
      text: promptCase.text,
      existingTranslations: promptCase.existingTranslations ?? [],
      tone: promptCase.tone,
      interest: promptCase.interest,
      useFewerWords: promptCase.useFewerWords,
    });
  }

  const basePrompt = buildTranslationPrompt({
    text: promptCase.text,
    existingTranslations: [],
    tone: promptCase.tone,
    interest: promptCase.interest,
    useFewerWords: promptCase.useFewerWords,
  });

  return `${basePrompt}${buildProposedFollowUpAddition(promptCase.existingTranslations ?? [])}`;
}

async function runPromptVariant(promptCase, variant) {
  const prompt = buildPromptVariant(promptCase, variant);
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

  return {
    variant,
    label: variant === 'current' ? 'Current follow-up prompt' : 'Proposed follow-up prompt',
    durationMs: Date.now() - startedAt,
    prompt,
    usageMetadata: response.usageMetadata ?? null,
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

function averagePromptTokens(results, variant) {
  const values = results
    .map((row) => row.outputs.find((output) => output.variant === variant))
    .filter(Boolean)
    .map((output) => output.usageMetadata?.promptTokenCount)
    .filter((value) => typeof value === 'number');

  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildMarkdown(results, timestamp) {
  const currentAverage = averagePromptTokens(results, 'current');
  const proposedAverage = averagePromptTokens(results, 'proposed');

  const lines = [];
  lines.push('# Get More Ideas Prompt Comparison');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('This report compares the current `Get more ideas` follow-up prompt against the proposed follow-up prompt guidance using **Gemini 2.5 Flash** only. It is designed for human review before any production implementation change.');
  lines.push('');
  lines.push('## Token Summary');
  lines.push('');
  lines.push(`- Current prompt average prompt tokens: **${currentAverage ?? 'n/a'}**`);
  lines.push(`- Proposed prompt average prompt tokens: **${proposedAverage ?? 'n/a'}**`);
  if (typeof currentAverage === 'number' && typeof proposedAverage === 'number') {
    lines.push(`- Average difference: **${proposedAverage - currentAverage}**`);
  }
  lines.push('');
  lines.push('## Review Guidance');
  lines.push('');
  lines.push('- Use [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md) while reviewing.');
  lines.push('- Treat any increase in generic language, praise-as-pressure, or missing task parts as more important than token differences.');
  lines.push('- For follow-up cases, distinctness matters, but not at the expense of authenticity or usefulness.');
  lines.push('- Be especially critical of the `Interest Based`, `Fewer Words`, and multi-part cases.');
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
    lines.push(`- Existing translations in prompt: ${result.existingTranslations.length}`);
    lines.push(`- Review focus: ${result.reviewFocus.join('; ')}`);
    lines.push('');

    for (const output of result.outputs) {
      lines.push(`### ${output.label}`);
      lines.push('');
      lines.push(`- Duration: ${output.durationMs} ms`);
      lines.push(`- Usage: ${formatUsage(output.usageMetadata)}`);
      lines.push('');
      if (output.translations.length === 0) {
        lines.push('_No valid JSON translations parsed from the response._');
      } else {
        output.translations.forEach((item, index) => {
          lines.push(`${index + 1}. ${item.translation}`);
        });
      }
      lines.push('');
    }

    lines.push('### Human Review Notes');
    lines.push('');
    lines.push('```txt');
    lines.push('Prompt verdict:');
    lines.push('- Current prompt: ');
    lines.push('- Proposed prompt: ');
    lines.push('');
    lines.push('What the current prompt did better:');
    lines.push('- ');
    lines.push('');
    lines.push('What the proposed prompt did better:');
    lines.push('- ');
    lines.push('');
    lines.push('Risks or regressions:');
    lines.push('- ');
    lines.push('');
    lines.push('Decision for this prompt:');
    lines.push('- Keep current / Proposed looks better / Needs more iteration');
    lines.push('```');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const startedAt = Date.now();
  console.log(`Running ${promptSet.length} Get more ideas prompt cases across 2 prompt variants...`);

  const results = [];
  for (const promptCase of promptSet) {
    console.log(`- ${promptCase.id}`);
    const currentOutput = await runPromptVariant(promptCase, 'current');
    const proposedOutput = await runPromptVariant(promptCase, 'proposed');
    results.push({
      ...promptCase,
      outputs: [currentOutput, proposedOutput],
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `get-more-ideas-prompt-comparison-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `get-more-ideas-prompt-comparison-${timestamp}.md`);
  const latestJsonPath = path.join(resultsDir, 'latest-get-more-ideas-prompt-comparison.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-get-more-ideas-prompt-comparison.md');

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
  console.error('Get more ideas prompt comparison failed:', error);
  process.exit(1);
});
