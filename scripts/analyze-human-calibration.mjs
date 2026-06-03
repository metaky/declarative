import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const outputPath = path.join(repoRoot, 'evals', 'results', 'human-calibration-analysis.md');

const VALID_VERDICTS = new Set(['Pass', 'Borderline', 'Fail']);

function normalizeVerdict(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pass') return 'Pass';
  if (normalized === 'borderline') return 'Borderline';
  if (normalized === 'fail') return 'Fail';
  return null;
}

function bestOptionVerdict(item) {
  const review = item.review ?? {};
  const count = String(review.bestOptionCount ?? '').trim();
  const hasExcellent = review.hasExcellentOption === true;
  const hasLegacySeriousMismatch = review.hasHarmfulOption === true;

  if (hasLegacySeriousMismatch || count === '0') return 'Fail';
  if (count === '3+' || count === '3') return 'Pass';
  if (count === '2') return hasExcellent ? 'Pass' : 'Borderline';
  if (count === '1') return 'Borderline';
  return null;
}

function loadCalibration() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing ${inputPath}. Run npm run quality:calibration-set first.`);
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

const calibration = loadCalibration();
const items = calibration.items ?? [];
const labeled = items.filter((item) => VALID_VERDICTS.has(normalizeVerdict(item.review?.setVerdict)));
const unlabeled = items.filter((item) => !VALID_VERDICTS.has(normalizeVerdict(item.review?.setVerdict)));
const comparable = labeled.filter((item) => item.automatedVerdict);
const agreements = comparable.filter((item) => normalizeVerdict(item.automatedVerdict) === normalizeVerdict(item.review?.setVerdict));
const humanVerdictCounts = labeled.reduce((counts, item) => {
  const verdict = normalizeVerdict(item.review?.setVerdict);
  counts[verdict] = (counts[verdict] ?? 0) + 1;
  return counts;
}, {});
const bestOptionCounts = labeled.reduce((counts, item) => {
  const count = String(item.review?.bestOptionCount ?? '').trim();
  counts[count] = (counts[count] ?? 0) + 1;
  return counts;
}, {});
const excellentCount = labeled.filter((item) => item.review?.hasExcellentOption === true).length;
const legacyMismatchCount = labeled.filter((item) => item.review?.hasHarmfulOption === true).length;
const heuristicDisagreements = labeled
  .map((item) => ({
    item,
    heuristic: bestOptionVerdict(item),
    human: normalizeVerdict(item.review?.setVerdict),
  }))
  .filter(({ heuristic, human }) => heuristic && human && heuristic !== human);

const automatedDisagreements = comparable.filter(
  (item) => normalizeVerdict(item.automatedVerdict) !== normalizeVerdict(item.review?.setVerdict)
);

const lines = [];
lines.push('# Human Calibration Analysis');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push(`- Total items: ${items.length}`);
lines.push(`- Labeled items: ${labeled.length}`);
lines.push(`- Unlabeled items: ${unlabeled.length}`);
lines.push(`- Human verdicts: Pass ${humanVerdictCounts.Pass ?? 0}, Borderline ${humanVerdictCounts.Borderline ?? 0}, Fail ${humanVerdictCounts.Fail ?? 0}`);
lines.push(`- Best option counts: 0=${bestOptionCounts['0'] ?? 0}, 1=${bestOptionCounts['1'] ?? 0}, 2=${bestOptionCounts['2'] ?? 0}, 3+=${bestOptionCounts['3+'] ?? 0}`);
lines.push(`- Sets with at least one excellent option: ${excellentCount}`);
lines.push(`- Sets with legacy serious-mismatch flags: ${legacyMismatchCount}`);
lines.push(`- Comparable automated items: ${comparable.length}`);
lines.push(`- Automated agreement: ${comparable.length ? `${agreements.length}/${comparable.length} (${Math.round((agreements.length / comparable.length) * 100)}%)` : 'not available yet'}`);
lines.push(`- Best-option heuristic disagreements: ${heuristicDisagreements.length}`);
lines.push('');

if (labeled.length) {
  lines.push('## Calibration Lessons');
  lines.push('');
  lines.push('- The old automated evaluator is not reliable enough to guide prompt changes by itself.');
  lines.push('- Kyle clarified that the old `hasHarmfulOption` labels usually meant "bad enough to fail the set" rather than real-world harm. Future evals should separate `shouldNotShow` from `seriousMismatch`.');
  lines.push('- Best-option count matters, but it is not sufficient by itself: tone fidelity and `Fewer Words` fidelity can downgrade a set even when one option is strong.');
  lines.push('- One excellent option should prevent an automatic fail unless the selected tone/filter mostly misses, task coverage is unsafe, or an option is bad enough that it should not be shown.');
  lines.push('- Questions are allowed and can soften a demand. They should be used as one strategy in the mix, not overused as the default pattern or disguised as faux choices.');
  lines.push('- `Fewer Words` should be materially shorter, not merely similar-length wording with the same toggle selected.');
  lines.push('- Standard-length outputs may be allowed to use a few more words when that makes them more conversational and declarative.');
  lines.push('- Interest Based needs true integration, not name-dropping. A single natural integrated option is useful signal, but most of the set still matters.');
  lines.push('- Equalizing needs the child to feel smart/strong/capable or the adult to need the child’s expertise. Merely adding an expert-ish word is not enough.');
  lines.push('- Humorous needs actual lightness or fun; exclamation points and ordinary declarative lines do not count as humor.');
  lines.push('');
}

if (unlabeled.length) {
  lines.push('## Next Manual Work');
  lines.push('');
  lines.push('Kyle still needs to label these items in `evals/human-calibration-set.json`:');
  lines.push('');
  for (const item of unlabeled.slice(0, 40)) {
    lines.push(`- ${item.id}`);
  }
  lines.push('');
}

if (automatedDisagreements.length) {
  lines.push('## Automated Disagreements');
  lines.push('');
  for (const item of automatedDisagreements.slice(0, 12)) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(`- Human: ${normalizeVerdict(item.review?.setVerdict)}`);
    lines.push(`- Automated: ${normalizeVerdict(item.automatedVerdict)}`);
    lines.push(`- Human note: ${item.review?.why || '(none)'}`);
    lines.push('');
  }
}

if (heuristicDisagreements.length) {
  lines.push('## Best-Option Heuristic Disagreements');
  lines.push('');
  lines.push('This heuristic treats the existing `hasHarmfulOption` values as Kyle’s legacy serious-mismatch flag, not as proof that an option was unsafe or shaming.');
  lines.push('');
  for (const { item, heuristic, human } of heuristicDisagreements.slice(0, 12)) {
    lines.push(`### ${item.id}`);
    lines.push('');
    lines.push(`- Human: ${human}`);
    lines.push(`- Best-option heuristic: ${heuristic}`);
    lines.push(`- bestOptionCount: ${item.review?.bestOptionCount}`);
    lines.push(`- hasExcellentOption: ${item.review?.hasExcellentOption}`);
    lines.push(`- legacy serious-mismatch flag (hasHarmfulOption): ${item.review?.hasHarmfulOption}`);
    lines.push(`- Human note: ${item.review?.why || '(none)'}`);
    lines.push('');
  }
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote calibration analysis to ${outputPath}`);
