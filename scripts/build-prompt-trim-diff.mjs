import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(repoRoot, 'evals', 'results');

const beforePath = path.join(resultsDir, 'gemini-model-comparison-2026-04-18T11-51-55-006Z.json');
const afterPath = path.join(resultsDir, 'gemini-model-comparison-2026-04-18T12-02-46-754Z.json');
const outputPath = path.join(resultsDir, 'gemini-trim-before-vs-after.md');

const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));

function usageSummary(usageMetadata) {
  if (!usageMetadata) return 'No usage metadata returned.';
  return [
    `promptTokenCount: ${usageMetadata.promptTokenCount ?? 'n/a'}`,
    `candidatesTokenCount: ${usageMetadata.candidatesTokenCount ?? 'n/a'}`,
    `thoughtsTokenCount: ${usageMetadata.thoughtsTokenCount ?? 'n/a'}`,
    `totalTokenCount: ${usageMetadata.totalTokenCount ?? 'n/a'}`,
  ].join(' | ');
}

function avgPromptTokens(rows) {
  const values = rows
    .map((row) => row.outputs.find((output) => output.model === 'gemini-2.5-flash'))
    .filter(Boolean)
    .map((output) => output.usageMetadata?.promptTokenCount)
    .filter((value) => typeof value === 'number');
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

const lines = [];
lines.push('# Gemini Prompt Trim Before vs After');
lines.push('');
lines.push('This report compares **Gemini 2.5 Flash before prompt trimming** vs **Gemini 2.5 Flash after prompt trimming** for the same 12 evaluation cases.');
lines.push('');
lines.push('Use this document when reviewing Step 5. It avoids making you compare across separate model-comparison reports.');
lines.push('');
lines.push('## Token Summary');
lines.push('');
lines.push(`- Before trim average prompt tokens: **${avgPromptTokens(before)}**`);
lines.push(`- After trim average prompt tokens: **${avgPromptTokens(after)}**`);
lines.push(`- Average reduction: **${avgPromptTokens(before) - avgPromptTokens(after)}**`);
lines.push('');
lines.push('## Review Guidance');
lines.push('');
lines.push('- Treat any drop in authenticity, safety, completeness, or usefulness as more important than token savings.');
lines.push('- Pay extra attention to Straightforward, Interest Based, Humorous, multi-part prompts, and `Get more ideas` follow-ups.');
lines.push('- Use [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md) while reviewing.');
lines.push('');

for (let index = 0; index < before.length; index += 1) {
  const beforeCase = before[index];
  const afterCase = after[index];
  const beforeFlash = beforeCase.outputs.find((output) => output.model === 'gemini-2.5-flash');
  const afterFlash = afterCase.outputs.find((output) => output.model === 'gemini-2.5-flash');

  lines.push(`## ${beforeCase.id} — ${beforeCase.label}`);
  lines.push('');
  lines.push(`- Tone: ${beforeCase.tone}`);
  lines.push(`- Fewer Words: ${beforeCase.useFewerWords ? 'Yes' : 'No'}`);
  if (beforeCase.interest) {
    lines.push(`- Interest: ${beforeCase.interest}`);
  }
  lines.push(`- Text: ${beforeCase.text}`);
  if (beforeCase.existingTranslations?.length) {
    lines.push(`- Existing translations in prompt: ${beforeCase.existingTranslations.length}`);
  }
  lines.push(`- Review focus: ${beforeCase.reviewFocus.join('; ')}`);
  lines.push('');

  lines.push('### Before Trim — Gemini 2.5 Flash');
  lines.push('');
  lines.push(`- Duration: ${beforeFlash.durationMs} ms`);
  lines.push(`- Usage: ${usageSummary(beforeFlash.usageMetadata)}`);
  lines.push('');
  beforeFlash.translations.forEach((item, itemIndex) => {
    lines.push(`${itemIndex + 1}. ${item.translation}`);
  });
  lines.push('');

  lines.push('### After Trim — Gemini 2.5 Flash');
  lines.push('');
  lines.push(`- Duration: ${afterFlash.durationMs} ms`);
  lines.push(`- Usage: ${usageSummary(afterFlash.usageMetadata)}`);
  lines.push('');
  afterFlash.translations.forEach((item, itemIndex) => {
    lines.push(`${itemIndex + 1}. ${item.translation}`);
  });
  lines.push('');

  lines.push('### Human Review Notes');
  lines.push('');
  lines.push('```txt');
  lines.push('Prompt verdict:');
  lines.push('- Before trim: ');
  lines.push('- After trim: ');
  lines.push('');
  lines.push('What improved after trim:');
  lines.push('- ');
  lines.push('');
  lines.push('What got worse after trim:');
  lines.push('- ');
  lines.push('');
  lines.push('Risks or regressions:');
  lines.push('- ');
  lines.push('');
  lines.push('Decision for this prompt:');
  lines.push('- Keep trim / Partially restore wording / Revert trim');
  lines.push('```');
  lines.push('');
}

fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote ${outputPath}`);
