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
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running the model comparison.');
  process.exit(1);
}

const evalPath = path.join(repoRoot, 'evals', 'gemini-translation-prompt-set.json');
const promptSet = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
const resultsDir = path.join(repoRoot, 'evals', 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const ai = new GoogleGenAI({ apiKey });
const models = [
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
];

async function runCase(promptCase) {
  const prompt = buildTranslationPrompt({
    text: promptCase.text,
    existingTranslations: promptCase.existingTranslations ?? [],
    tone: promptCase.tone,
    interest: promptCase.interest,
    useFewerWords: promptCase.useFewerWords,
  });

  const outputs = [];
  for (const model of models) {
    const startedAt = Date.now();
    const response = await ai.models.generateContent({
      model: model.id,
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

    outputs.push({
      model: model.id,
      label: model.label,
      durationMs: Date.now() - startedAt,
      usageMetadata: response.usageMetadata ?? null,
      translations,
    });
  }

  return {
    ...promptCase,
    prompt,
    outputs,
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
  lines.push('# Gemini Model Comparison Report');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('This report is designed for human review. Use it alongside `evals/gemini-quality-rubric.md` and be critical of any output that becomes less authentic, less complete, less safe, or less useful even if it is cheaper.');
  lines.push('');
  lines.push('Review instructions:');
  lines.push('- Read each prompt pair side by side before deciding.');
  lines.push('- Check the blocking criteria in the rubric first.');
  lines.push('- Treat any regression in safety, authenticity, or multi-part coverage as a blocker.');
  lines.push('- Add your own notes directly under each prompt section or in a copied review document.');
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
    if (result.existingTranslations?.length) {
      lines.push(`- Existing translations in prompt: ${result.existingTranslations.length}`);
    }
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
        lines.push('');
      } else {
        output.translations.forEach((item, index) => {
          lines.push(`${index + 1}. ${item.translation}`);
        });
        lines.push('');
      }
    }

    lines.push('### Human Review Notes');
    lines.push('');
    lines.push('```txt');
    lines.push('Prompt verdict:');
    lines.push('- Flash: ');
    lines.push('- Flash-Lite: ');
    lines.push('');
    lines.push('What Flash did better:');
    lines.push('- ');
    lines.push('');
    lines.push('What Flash-Lite did better:');
    lines.push('- ');
    lines.push('');
    lines.push('Risks or regressions:');
    lines.push('- ');
    lines.push('');
    lines.push('Decision for this prompt:');
    lines.push('- ');
    lines.push('```');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const startedAt = Date.now();
  console.log(`Running ${promptSet.length} evaluation cases across ${models.length} models...`);

  const results = [];
  for (const promptCase of promptSet) {
    console.log(`- ${promptCase.id}`);
    results.push(await runCase(promptCase));
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `gemini-model-comparison-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `gemini-model-comparison-${timestamp}.md`);
  const latestJsonPath = path.join(resultsDir, 'latest-gemini-model-comparison.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-gemini-model-comparison.md');

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
  console.error('Gemini model comparison failed:', error);
  process.exit(1);
});
