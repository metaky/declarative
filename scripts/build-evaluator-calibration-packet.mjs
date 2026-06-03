import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const inputPath = path.join(repoRoot, 'evals', 'human-calibration-set.json');
const outputPath = path.join(repoRoot, 'evals', 'results', 'evaluator-calibration-packet.md');

const VALID_VERDICTS = new Set(['Pass', 'Borderline', 'Fail']);
const REVIEW_CASE_IDS = [
  'current-01-running-house-default-standard',
  'current-12-dinner-hands-default-fewer',
  'current-15-dinner-hands-humorous-standard',
  'current-19-dinner-hands-interest-based-standard',
  'current-28-toys-upstairs-equalizing-fewer',
  'current-08-running-house-equalizing-fewer',
  'current-13-dinner-hands-straightforward-standard',
  'current-21-toys-upstairs-default-standard',
  'current-29-toys-upstairs-interest-based-standard',
  'anchor-good-safety-default',
];

function normalizeVerdict(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pass') return 'Pass';
  if (normalized === 'borderline') return 'Borderline';
  if (normalized === 'fail') return 'Fail';
  return null;
}

function loadCalibration() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing ${inputPath}. Run npm run quality:calibration-set first.`);
  }
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

function safeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function includesAny(text, terms) {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

function countWhere(items, predicate) {
  return items.filter(predicate).length;
}

function getHumanVerdict(item) {
  return normalizeVerdict(item.review?.setVerdict);
}

function getAutomatedVerdict(item) {
  return normalizeVerdict(item.automatedVerdict);
}

function buildToneSummary(items) {
  const tones = new Map();
  for (const item of items) {
    const tone = item.tone ?? 'Unknown';
    if (!tones.has(tone)) tones.set(tone, []);
    tones.get(tone).push(item);
  }

  return [...tones.entries()].map(([tone, toneItems]) => {
    const pass = countWhere(toneItems, (item) => getHumanVerdict(item) === 'Pass');
    const borderline = countWhere(toneItems, (item) => getHumanVerdict(item) === 'Borderline');
    const fail = countWhere(toneItems, (item) => getHumanVerdict(item) === 'Fail');
    const excellent = countWhere(toneItems, (item) => item.review?.hasExcellentOption === true);
    return { tone, count: toneItems.length, pass, borderline, fail, excellent };
  });
}

function renderCase(item) {
  const lines = [];
  lines.push(`### ${item.id}`);
  lines.push('');
  lines.push(`- Human verdict: ${getHumanVerdict(item)}`);
  lines.push(`- Prior automated verdict: ${getAutomatedVerdict(item) ?? 'n/a'}`);
  lines.push(`- Tone: ${item.tone}; Fewer Words: ${item.useFewerWords ? 'On' : 'Off'}`);
  lines.push(`- bestOptionCount: ${item.review?.bestOptionCount}; hasExcellentOption: ${item.review?.hasExcellentOption}; legacy serious-mismatch flag: ${item.review?.hasHarmfulOption}`);
  lines.push(`- Kyle note: ${safeText(item.review?.why) || '(none)'}`);
  lines.push('');
  lines.push('Outputs:');
  item.translations.forEach((translation, index) => {
    lines.push(`${index + 1}. ${translation.translation} [${translation.wordCount} words]`);
  });
  lines.push('');
  return lines;
}

const calibration = loadCalibration();
const items = (calibration.items ?? []).filter((item) => VALID_VERDICTS.has(getHumanVerdict(item)));
const comparable = items.filter((item) => getAutomatedVerdict(item));
const disagreements = comparable.filter((item) => getHumanVerdict(item) !== getAutomatedVerdict(item));
const falseNegatives = disagreements.filter((item) => getAutomatedVerdict(item) === 'Fail' && getHumanVerdict(item) !== 'Fail');
const falsePositives = disagreements.filter((item) => getAutomatedVerdict(item) !== 'Fail' && getHumanVerdict(item) === 'Fail');
const fewerWordsCases = items.filter((item) => item.useFewerWords && includesAny(item.review?.why, ['fewer', 'fewwer', 'short', 'shorter']));
const conversationalCases = items.filter((item) => includesAny(item.review?.why, ['conversational', 'abrupt', 'terse', 'more words', 'expanded', 'short']));
const interestCases = items.filter((item) => item.tone === 'Interest Based');
const equalizingCases = items.filter((item) => item.tone === 'Equalizing');
const humorousCases = items.filter((item) => item.tone === 'Humorous');
const oneExcellentFails = items.filter((item) => item.review?.hasExcellentOption === true && getHumanVerdict(item) === 'Fail');
const reviewCases = REVIEW_CASE_IDS.map((id) => items.find((item) => item.id === id)).filter(Boolean);

const lines = [];
lines.push('# Evaluator Calibration Packet');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('This packet translates Kyle’s completed review into concrete evaluator-tuning guidance. It treats the existing `hasHarmfulOption` field as a legacy serious-mismatch flag unless the note clearly describes a true should-not-show issue.');
lines.push('');
lines.push('## Snapshot');
lines.push('');
lines.push(`- Labeled sets: ${items.length}`);
lines.push(`- Comparable prior automated sets: ${comparable.length}`);
lines.push(`- Prior automated disagreements: ${disagreements.length}`);
lines.push(`- False negatives, where automation failed a human Pass/Borderline: ${falseNegatives.length}`);
lines.push(`- False positives, where automation passed/borderlined a human Fail: ${falsePositives.length}`);
lines.push(`- Fewer Words fidelity cases called out by notes: ${fewerWordsCases.length}`);
lines.push(`- Cases with at least one excellent option but human Fail: ${oneExcellentFails.length}`);
lines.push('');
lines.push('## Tone Distribution From Human Labels');
lines.push('');
lines.push('| Tone | Sets | Pass | Borderline | Fail | Sets With Excellent Option |');
lines.push('|---|---:|---:|---:|---:|---:|');
for (const row of buildToneSummary(items)) {
  lines.push(`| ${row.tone} | ${row.count} | ${row.pass} | ${row.borderline} | ${row.fail} | ${row.excellent} |`);
}
lines.push('');
lines.push('## Top Evaluator Bias Patterns');
lines.push('');
lines.push('1. The evaluator was too harsh on short-but-usable safety/default outputs. Kyle accepted several terse running-house outputs as useful, while still noting that standard mode could be more conversational.');
lines.push('2. The evaluator underweighted `Fewer Words` fidelity. Kyle failed or downgraded sets where the toggle was on but outputs were not materially shorter, even when an individual line was otherwise decent.');
lines.push('3. The evaluator over-rewarded one strong Interest Based or Equalizing option when most of the set missed the tone strategy. Kyle values a great option, but tone filters still need set-level consistency.');
lines.push('4. The evaluator under-recognized real Humorous success. Kyle counted playful rhythm/fun as successful humor and rejected mere exclamation points as insufficient.');
lines.push('5. The evaluator did not distinguish serious mismatch from true should-not-show harm. This made failures less actionable and made the system seem more safety-critical than Kyle intended.');
lines.push('');
lines.push('## Calibrated Evaluator Wording To Add');
lines.push('');
lines.push('- Do not fail a set only because outputs are short or plain if at least 1-2 options are genuinely usable and the selected mode is not `Fewer Words`-violating.');
lines.push('- For `Fewer Words`, compare against the standard expectation: the set should be materially compact while still preserving safety, sequence, and destination.');
lines.push('- For Interest Based with an entered interest, every option must meaningfully use the interest or a recognizable element from it. A single excellent option is useful signal, but the set cannot pass when any option misses meaningful interest integration.');
lines.push('- Interest Based integration still has to be factual and grounded. Do not count false labels or name-drops like "Pokemon toys" for generic toys, "Pokemon clean hands," "Pokemon quick stop: hands, then dinner," or invented Pokemon storage/places as successful interest use.');
lines.push('- Count recognizable interest elements when they fit the task logic, such as Squirtle for sink/water/handwashing or a Poke-stop/trainer route for a transition sequence.');
lines.push('- For Equalizing, a single excellent option is useful signal, but the set can still fail when most options miss the selected tone strategy.');
lines.push('- For Humorous, reward actual lightness, playful rhythm, or a small fun image; do not count punctuation alone as humor.');
lines.push('- Treat questions as valid declarative-adjacent softening when they invite collaboration or wondering. Penalize fake choices, question-demands, and repetitive question-only sets.');
lines.push('- Reserve `shouldNotShow` for output that should not be displayed. Use `seriousMismatch` for severe tone/filter/declarative misses.');
lines.push('');
lines.push('## Suggested Kyle Review Cases');
lines.push('');
lines.push('These are the highest-value examples for manual disagreement review or compact evaluator few-shots.');
lines.push('');
for (const item of reviewCases) {
  lines.push(...renderCase(item));
}
lines.push('## Prompt And Product Implications');
lines.push('');
lines.push('- Standard mode needs room for slightly more conversational language on very short inputs, without making Fewer Words indistinguishable from standard mode.');
lines.push('- Fewer Words should be judged as its own product behavior, not just as "also declarative."');
lines.push('- Tone prompts should optimize for more excellent options per set, not just one standout line.');
lines.push('- The evaluator should report best option yield and set consistency separately so a useful set is not discarded and a one-good-line set is not over-celebrated.');
lines.push('');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Wrote evaluator calibration packet to ${outputPath}`);
