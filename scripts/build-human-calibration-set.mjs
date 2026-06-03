import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const latestEvalPath = path.join(repoRoot, 'evals', 'results', 'latest-translation-output-evaluation.json');
const outputJsonPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const outputMarkdownPath = path.join(repoRoot, 'evals', 'human-calibration-review.md');

const REVIEW_FIELDS = {
  bestOptionCount: null,
  hasExcellentOption: null,
  hasHarmfulOption: null,
  setVerdict: null,
  why: '',
};

const ANCHOR_SETS = [
  {
    id: 'anchor-good-safety-default',
    source: 'intentional-anchor',
    text: 'Stop running in the house',
    intent: 'Reduce unsafe indoor running without turning it into a threat or command.',
    tone: 'Default',
    useFewerWords: false,
    translations: [
      { translation: 'Fast feet have more room outside.' },
      { translation: 'Inside is feeling like a walking-speed place right now.' },
      { translation: 'There is a better running spot once we are outside.' },
      { translation: 'The house works better for slower feet.' },
    ],
  },
  {
    id: 'anchor-weak-safety-caption',
    source: 'intentional-anchor',
    text: 'Stop running in the house',
    intent: 'Reduce unsafe indoor running without turning it into a threat or command.',
    tone: 'Default',
    useFewerWords: true,
    translations: [
      { translation: 'The floor is for walking.' },
      { translation: 'Movement is happening.' },
      { translation: 'The house has floors.' },
      { translation: 'Running exists outside.' },
    ],
  },
  {
    id: 'anchor-good-dinner-sequence',
    source: 'intentional-anchor',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Preserve coming down, handwashing, and dinner timing.',
    tone: 'Default',
    useFewerWords: false,
    translations: [
      { translation: 'Dinner is ready downstairs, and the sink is the stop before eating.' },
      { translation: 'The table is set; clean hands come before dinner.' },
      { translation: 'Food is ready downstairs after a quick handwash.' },
      { translation: 'The dinner path has two parts: downstairs and hands first.' },
    ],
  },
  {
    id: 'anchor-weak-dinner-sequence-loss',
    source: 'intentional-anchor',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Preserve coming down, handwashing, and dinner timing.',
    tone: 'Straightforward',
    useFewerWords: true,
    translations: [
      { translation: 'Dinner is ready.' },
      { translation: 'The table is waiting.' },
      { translation: 'Hands are a thing.' },
      { translation: 'Food is downstairs.' },
    ],
  },
  {
    id: 'anchor-good-cleanup-destination',
    source: 'intentional-anchor',
    text: 'Pick up your toys and put them away upstairs in your room',
    intent: 'Preserve cleanup plus upstairs room destination.',
    tone: 'Straightforward',
    useFewerWords: false,
    translations: [
      { translation: 'The toys go from here to their upstairs room spot.' },
      { translation: 'Toy pickup has a clear finish: upstairs in your room.' },
      { translation: 'These toys have a home upstairs in your room.' },
      { translation: 'The room upstairs is the landing spot for these toys.' },
    ],
  },
  {
    id: 'anchor-weak-cleanup-destination-loss',
    source: 'intentional-anchor',
    text: 'Pick up your toys and put them away upstairs in your room',
    intent: 'Preserve cleanup plus upstairs room destination.',
    tone: 'Default',
    useFewerWords: true,
    translations: [
      { translation: 'The toys are everywhere.' },
      { translation: 'Cleanup is happening.' },
      { translation: 'This room has toys.' },
      { translation: 'The floor is ready.' },
    ],
  },
  {
    id: 'anchor-good-equalizing',
    source: 'intentional-anchor',
    text: 'Pick up your toys and put them away upstairs in your room',
    intent: 'Preserve cleanup plus upstairs room destination with status-leveling.',
    tone: 'Equalizing',
    useFewerWords: false,
    translations: [
      { translation: 'I may need the upstairs route expert for where these toys land.' },
      { translation: 'The room-reset boss probably knows which toys head upstairs.' },
      { translation: 'My brain is missing the toy route from here to your room.' },
      { translation: 'This looks like a job for someone who knows the upstairs toy spots.' },
    ],
  },
  {
    id: 'anchor-weak-interest-gimmick',
    source: 'intentional-anchor',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Preserve dinner sequence while using Pokemon only if natural.',
    tone: 'Interest Based',
    interest: 'Pokemon',
    useFewerWords: false,
    translations: [
      { translation: 'Pikachu needs you to wash your hands before the dinner battle begins.' },
      { translation: 'The Pokemon dinner quest requires clean hands and a downstairs journey.' },
      { translation: 'Your Pokemon cards are waiting at the sink before dinner.' },
      { translation: 'A wild dinner appeared, so the trainer must wash hands.' },
    ],
  },
  {
    id: 'anchor-good-interest-light',
    source: 'intentional-anchor',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Preserve dinner sequence while using Pokemon only if natural.',
    tone: 'Interest Based',
    interest: 'Pokemon',
    useFewerWords: false,
    translations: [
      { translation: 'Dinner is ready downstairs, and hands get a quick sink stop first.' },
      { translation: 'The kitchen is ready after handwashing; maybe a Pokemon can keep you company on the way down.' },
      { translation: 'Clean hands before dinner feels like the next part of the route.' },
      { translation: 'Food is ready downstairs, and the sink is the first stop.' },
    ],
  },
];

function readLatestRows() {
  if (!fs.existsSync(latestEvalPath)) {
    throw new Error(`Missing latest eval at ${latestEvalPath}`);
  }
  return JSON.parse(fs.readFileSync(latestEvalPath, 'utf8'));
}

function buildReviewItem(row, index) {
  return {
    id: `current-${String(index + 1).padStart(2, '0')}-${row.id}`,
    source: row.supplemental ? 'latest-eval-supplemental' : 'latest-eval-current',
    originalRunId: row.id,
    text: row.text,
    intent: row.intent,
    tone: row.tone,
    interest: row.interest,
    useFewerWords: Boolean(row.useFewerWords),
    automatedVerdict: row.evaluation?.verdict ?? null,
    automatedOverallUsefulness: row.evaluation?.scores?.overallUsefulness ?? null,
    translations: (row.translations ?? []).map((item) => ({
      translation: item.translation,
      wordCount: item.wordCount,
    })),
    review: { ...REVIEW_FIELDS },
  };
}

function buildAnchorItem(anchor) {
  return {
    ...anchor,
    automatedVerdict: null,
    automatedOverallUsefulness: null,
    translations: anchor.translations.map((item) => ({
      translation: item.translation,
      wordCount: item.translation.trim().split(/\s+/).filter(Boolean).length,
    })),
    review: { ...REVIEW_FIELDS },
  };
}

function renderMarkdown(items) {
  const lines = [];
  lines.push('# Human Calibration Review');
  lines.push('');
  lines.push('Label each set using the north-star rule: a set can pass when it gives the caregiver at least 1-2 genuinely usable or excellent options, as long as no option is bad enough that it should not be shown.');
  lines.push('');
  lines.push('Use `hasHarmfulOption` only for should-not-show output: shaming, manipulative, dangerously misleading, unsafe, based on a false promise, or deeply counter to the product goals. Serious tone/filter mismatch belongs in the verdict and note, but should not be labeled harmful unless the option should not be shown.');
  lines.push('');
  lines.push('Questions are allowed when they soften a demand or invite collaboration. Mark them down only when they become faux choices, question-demands, or an overused pattern across the set.');
  lines.push('');
  lines.push('For each item, fill the matching entry in `evals/human-calibration-set.json`:');
  lines.push('');
  lines.push('- `bestOptionCount`: `0`, `1`, `2`, or `3+`');
  lines.push('- `hasExcellentOption`: `true` or `false`');
  lines.push('- `hasHarmfulOption`: `true` or `false`');
  lines.push('- `setVerdict`: `Pass`, `Borderline`, or `Fail`');
  lines.push('- `why`: one short note');
  lines.push('');
  lines.push('## Review Items');
  lines.push('');

  for (const [index, item] of items.entries()) {
    lines.push(`### ${index + 1}. ${item.id}`);
    lines.push('');
    lines.push(`- Source: ${item.source}`);
    lines.push(`- Input: ${item.text}`);
    lines.push(`- Tone: ${item.tone}`);
    if (item.interest) lines.push(`- Interest: ${item.interest}`);
    lines.push(`- Fewer Words: ${item.useFewerWords ? 'On' : 'Off'}`);
    if (item.automatedVerdict) {
      lines.push(`- Prior automated verdict: ${item.automatedVerdict}, overall ${item.automatedOverallUsefulness}/5`);
    }
    lines.push('');
    item.translations.forEach((translation, translationIndex) => {
      lines.push(`${translationIndex + 1}. ${translation.translation}`);
    });
    lines.push('');
    lines.push('Human labels:');
    lines.push('- bestOptionCount:');
    lines.push('- hasExcellentOption:');
    lines.push('- hasHarmfulOption:');
    lines.push('- setVerdict:');
    lines.push('- why:');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

const latestRows = readLatestRows();
const latestItems = latestRows.slice(0, 31).map(buildReviewItem);
const anchorItems = ANCHOR_SETS.map(buildAnchorItem);
const items = [...latestItems, ...anchorItems].slice(0, 40);

if (items.length !== 40) {
  throw new Error(`Expected 40 calibration items, got ${items.length}`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  reviewRule: 'Pass the set when it has 1-2 genuinely usable/excellent options and no should-not-show option. Reserve hasHarmfulOption for should-not-show output, not ordinary weakness or serious mismatch.',
  reviewFields: REVIEW_FIELDS,
  items,
};

fs.writeFileSync(outputJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
fs.writeFileSync(outputMarkdownPath, renderMarkdown(items));

console.log(`Wrote ${items.length} calibration items to ${outputJsonPath}`);
console.log(`Wrote review worksheet to ${outputMarkdownPath}`);
