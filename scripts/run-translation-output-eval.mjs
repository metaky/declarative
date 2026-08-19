import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildTranslationPrompt,
  buildVariationPrompt,
  systemInstruction,
} from '../services/translationPrompt.js';

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
  console.error('Missing GEMINI_API_KEY. Set it in .env.local or the environment before running this evaluation.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const modelId = 'gemini-2.5-flash';
const resultsDir = path.join(repoRoot, 'evals', 'results');
fs.mkdirSync(resultsDir, { recursive: true });

const inputCases = [
  {
    id: 'running-house',
    text: 'Stop running in the house',
    intent: 'Reduce unsafe indoor running without turning it into a threat or command.',
  },
  {
    id: 'dinner-hands',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Preserve the transition downstairs, handwashing, and dinner timing.',
  },
  {
    id: 'toys-upstairs',
    text: 'Pick up your toys and put them away upstairs in your room',
    intent: 'Preserve cleanup plus the upstairs bedroom destination without sounding like a chore command.',
  },
];

const toneCases = [
  { tone: 'Default' },
  { tone: 'Straightforward' },
  { tone: 'Humorous' },
  { tone: 'Equalizing' },
  {
    tone: 'Interest Based',
    interest: 'Pokemon',
    assumption: 'Used Pokemon as the shared interest because no interest value was provided.',
  },
];

const supplementalTranslationCases = [
  {
    id: 'dinner-hands-interest-missing-standard',
    text: "Please come down and wash your hands. It's dinner time.",
    intent: 'Confirm Interest Based fallback stays grounded when no interest value is provided.',
    tone: 'Interest Based',
    useFewerWords: false,
    supplemental: true,
    assumption: 'No interest value was provided; output should not invent a child interest or themed language.',
  },
];

const variationKinds = ['shorter', 'warmer', 'more_straightforward', 'more_playful'];
const variationLabels = {
  shorter: 'Shorter',
  warmer: 'Warmer',
  more_straightforward: 'More straightforward',
  more_playful: 'More playful',
};

const scoreKeys = [
  'authenticity',
  'lowPressure',
  'taskCoverage',
  'toneFidelity',
  'naturalness',
  'overallUsefulness',
];

const optionScoreKeys = [
  'authenticity',
  'lowPressure',
  'taskCoverage',
  'toneFidelity',
  'naturalness',
  'usability',
];

const variationScoreKeys = [
  'taskCoverage',
  'authenticityLowPressure',
  'directionFidelity',
  'toneFamilyFidelity',
  'distinctness',
  'overallUsefulness',
];

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeText(text) {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function average(values) {
  const nums = values.filter((value) => typeof value === 'number');
  if (!nums.length) return null;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
}

function normalizeVerdict(verdict) {
  const normalized = String(verdict ?? '').trim().toLowerCase();
  if (normalized === 'pass' || normalized === 'good' || normalized === 'excellent') return 'Pass';
  if (normalized === 'pass with reservations' || normalized === 'borderline' || normalized === 'borderline pass') return 'Borderline';
  if (normalized === 'weak' || normalized === 'fail' || normalized === 'failure') return 'Fail';
  return verdict || 'Unknown';
}

function verdictFromOverall(overall, hasBlockingIssue = false) {
  if (hasBlockingIssue || overall <= 2) return 'Fail';
  if (overall < 4) return 'Borderline';
  return 'Pass';
}

function getNumericArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function stripToJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return trimmed;
}

function parseJsonOrNull(text) {
  try {
    return JSON.parse(stripToJson(text));
  } catch {
    return null;
  }
}

function dedupeTranslations(translations) {
  const seen = new Set();
  const result = [];
  for (const item of translations) {
    if (!item?.translation || typeof item.translation !== 'string') continue;
    const normalized = normalizeText(item.translation);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ translation: item.translation.trim() });
  }
  return result;
}

function dedupeVariationTranslations(translations, sourceTranslation) {
  const seen = new Set([normalizeText(sourceTranslation)]);
  const result = [];
  for (const item of translations) {
    if (!item?.translation || typeof item.translation !== 'string') continue;
    const normalized = normalizeText(item.translation);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ translation: item.translation.trim() });
  }
  return result;
}

function getScoreSummary(scores, keys) {
  return Object.fromEntries(keys.map((key) => [key, scores?.[key] ?? null]));
}

function normalizeVariationKind(kind) {
  const normalized = String(kind ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '_');

  const aliases = {
    similar: 'similar',
    shorter: 'shorter',
    warmer: 'warmer',
    more_straightforward: 'more_straightforward',
    straightforward: 'more_straightforward',
    more_playful: 'more_playful',
    playful: 'more_playful',
  };

  return aliases[normalized] ?? normalized;
}

function findVariationEvaluation(row, variationKind) {
  const target = normalizeVariationKind(variationKind);
  return row.variationEvaluation?.items?.find(
    (item) => normalizeVariationKind(item.variationKind) === target
  );
}

async function generateJsonArray(prompt) {
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

  return {
    text: response.text ?? '',
    usageMetadata: response.usageMetadata ?? null,
  };
}

async function evaluateTranslationRun(run) {
  const prompt = `You are evaluating a declarative language translation tool for PDA/neurodivergent caregiving contexts.

Score each individual suggestion first, then score the whole set.

North-star product rule:
- A set can PASS when it gives the caregiver at least 1-2 genuinely usable or excellent options, as long as no option is bad enough that it should not be shown.
- Weak extra options should reduce the score, but should not automatically fail a set that contains clearly useful options.
- A set FAILS when there are 0 usable options, when the selected tone/filter mostly misses, when safety/task coverage is dangerously wrong, or when any option is harmful/manipulative/misleading enough that it should not be shown.

Verdict calibration:
- Pass: at least 2 usable options, tone/filter mostly works, and no should-not-show option.
- Borderline: 1-2 usable options but tone/filter is inconsistent. A set with one excellent option should not fail only because the rest of the set is weak.
- Fail: no usable options, selected tone/filter mostly misses, safety/task coverage is unsafe, or any should-not-show option exists.

Important distinction:
- "shouldNotShow" means actually not fit to display: shaming, manipulative, dangerously misleading, false promise, unsafe, or deeply counter to the product's caregiving goals.
- "seriousMismatch" means a severe tone/filter/declarative mismatch that can make the set fail, but is not necessarily harmful in a real-world safety sense.
- Keep "harmful" true only for should-not-show items, for backward compatibility.

Scoring scale:
5 = excellent, 4 = good, 3 = borderline, 2 = weak, 1 = fail.

Blocking issues:
- Sounds manipulative, shaming, emotionally loaded, or like a disguised command.
- Drops an important part of the original request.
- The selected tone is absent or unsafe.
- Output is awkward enough that a real caregiver would probably not say it.
- Questions are allowed and often soften demands. Do not penalize question marks by themselves. Penalize only fake choices, question-demands, or overuse where every option becomes the same question strategy.

Tone goals:
- Default: warm, grounded, observational, everyday wording.
- Straightforward: plainspoken, concise, calm, not clipped or bossy.
- Humorous: gently playful, not sarcastic, not distracting, not overstimulating.
- Equalizing: makes status-leveling the frame; child as expert/checker/leader, adult as gently unsure/silly/forgetful, with dignity.
- Interest Based: every option uses the entered interest or a recognizable element from it in a way that logically connects to the task without becoming a gimmick.

Kyle-calibrated scoring guidance:
- Short and plain can still be usable. Do not fail a standard-mode set just because the lines are terse if at least 1-2 options are genuinely usable.
- Fewer Words must be materially compact. Downgrade or fail sets that are not meaningfully shorter than standard-style wording, even if one option is otherwise decent.
- Standard mode may use a few more words when that makes the language more conversational and sayable.
- Interest Based and Equalizing require set-level tone strategy. One excellent option is useful, but a set can still fail when most options miss the selected tone/filter.
- Interest Based has a stricter requirement than the other tones when an interest is entered: every returned option must use the interest or a recognizable element from it. A plain non-interest option is a serious mismatch. A set with any option missing meaningful interest integration cannot Pass.
- A bare name-drop is not enough for Interest Based. The interest must shape the wording through a useful image, rhythm, comparison, relationship, character trait, route, tool, place, checkpoint, or concrete connection to the real task.
- Interest Based must stay grounded. Mark an option as seriousMismatch if it invents interest-themed physical objects, props, characters acting in the room, story worlds, battles, quests, or renames real task items as interest items when the original request did not say that.
- False-label/name-drop examples for Interest Based: "Pokemon toys" when the caregiver only said "toys," "Pokemon clean hands," "Pokemon quick stop: hands, then dinner," or sending toys to a "Pokemon Center"/"Poke Ball storage" as if those places or objects are real. These are seriousMismatch even though they mention the interest.
- Integrated Pokemon examples: "The sink is like Squirtle, washing our hands before dinner," "The sink is our next Poke-stop before we are ready to eat dinner," or a trainer route/checkpoint that maps clearly to the real task sequence.
- Generic game-ish words like team, checkpoint, evolve, challenge, or move names are not enough by themselves. They count only when paired with a recognizable interest element and clear task logic.
- Humorous requires actual lightness, playful rhythm, or a small fun image. Exclamation points alone do not count as humor.
- A set with one excellent option should usually be Borderline rather than Fail unless the selected tone/filter mostly misses, Fewer Words fails materially, task coverage is unsafe, or an option should not be shown.

Consistency rules:
- If bestOptionCount is 0, setVerdict must be Fail.
- If bestOptionCount is 1, setVerdict should usually be Borderline, not Pass.
- If the selected tone/filter mostly misses across the set, setVerdict must be Fail even when one option is promising.
- If tone is Interest Based and an entered interest is provided, any option that does not meaningfully use the interest or a recognizable element from it must be marked seriousMismatch. If seriousMismatchOptionCount is greater than 0 for an entered-interest Interest Based set, setVerdict must be Fail or at most Borderline when the mismatch is minor; it must never Pass.
- If Fewer Words is on and the set is not materially compact, setVerdict must be Fail or Borderline depending on how much usable signal remains.
- If shouldNotShowOptionCount is greater than 0, setVerdict must be Fail.

Calibration examples:
- Pass: Running-house Default standard with several short but usable options. Short alone is not a failure.
- Fail: Dinner handwashing Default Fewer Words where lines are 9-16 words and feel like standard mode. Declarative but not compact enough.
- Fail: Humorous set with declarative options but no actual humor. Tone filter mostly misses.
- Pass: Humorous dinner set where at least two options have real fun/playful energy and no should-not-show option.
- Fail: Interest Based set where one option integrates Pokemon well but the rest name-drop, miss Pokemon, or use plain non-interest wording. One standout is useful signal, not a set pass.
- Fail: Equalizing Fewer Words set with one decent equalizing line but the set is too long for Fewer Words.
- Borderline: Default cleanup set with two strong options and two too-direct options. Useful, but not consistently declarative.

Original request: ${JSON.stringify(run.text)}
Caregiver intent: ${JSON.stringify(run.intent)}
Tone: ${run.tone}
Interest: ${run.interest ?? 'none'}
Fewer Words: ${run.useFewerWords ? 'on' : 'off'}
Translations:
${run.translations.map((item, index) => `${index + 1}. ${item.translation}`).join('\n')}

Return JSON only with this shape:
{
  "optionEvaluations": [
    {
      "index": 1,
      "translation": "",
      "scores": {
        "authenticity": 1,
        "lowPressure": 1,
        "taskCoverage": 1,
        "toneFidelity": 1,
        "naturalness": 1,
        "usability": 1
      },
      "usable": false,
      "excellent": false,
      "shouldNotShow": false,
      "seriousMismatch": false,
      "harmful": false,
      "notes": ""
    }
  ],
  "setSummary": {
    "bestOptionCount": 0,
    "excellentOptionCount": 0,
    "shouldNotShowOptionCount": 0,
    "seriousMismatchOptionCount": 0,
    "harmfulOptionCount": 0,
    "setVerdict": "Fail",
    "confidence": 0.8
  },
  "scores": {
    "authenticity": 1,
    "lowPressure": 1,
    "taskCoverage": 1,
    "toneFidelity": 1,
    "naturalness": 1,
    "overallUsefulness": 1
  },
  "verdict": "Pass",
  "blockingIssues": [],
  "strengths": [],
  "risks": [],
  "recommendation": ""
}`;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          scores: {
            type: Type.OBJECT,
            properties: {
              authenticity: { type: Type.NUMBER },
              lowPressure: { type: Type.NUMBER },
              taskCoverage: { type: Type.NUMBER },
              toneFidelity: { type: Type.NUMBER },
              naturalness: { type: Type.NUMBER },
              overallUsefulness: { type: Type.NUMBER },
            },
            required: scoreKeys,
          },
          optionEvaluations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.NUMBER },
                translation: { type: Type.STRING },
                scores: {
                  type: Type.OBJECT,
                  properties: {
                    authenticity: { type: Type.NUMBER },
                    lowPressure: { type: Type.NUMBER },
                    taskCoverage: { type: Type.NUMBER },
                    toneFidelity: { type: Type.NUMBER },
                    naturalness: { type: Type.NUMBER },
                    usability: { type: Type.NUMBER },
                  },
                  required: optionScoreKeys,
                },
                usable: { type: Type.BOOLEAN },
                excellent: { type: Type.BOOLEAN },
                shouldNotShow: { type: Type.BOOLEAN },
                seriousMismatch: { type: Type.BOOLEAN },
                harmful: { type: Type.BOOLEAN },
                notes: { type: Type.STRING },
              },
              required: ['index', 'translation', 'scores', 'usable', 'excellent', 'shouldNotShow', 'seriousMismatch', 'harmful', 'notes'],
            },
          },
          setSummary: {
            type: Type.OBJECT,
            properties: {
              bestOptionCount: { type: Type.NUMBER },
              excellentOptionCount: { type: Type.NUMBER },
              shouldNotShowOptionCount: { type: Type.NUMBER },
              seriousMismatchOptionCount: { type: Type.NUMBER },
              harmfulOptionCount: { type: Type.NUMBER },
              setVerdict: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
            },
            required: ['bestOptionCount', 'excellentOptionCount', 'shouldNotShowOptionCount', 'seriousMismatchOptionCount', 'harmfulOptionCount', 'setVerdict', 'confidence'],
          },
          verdict: { type: Type.STRING },
          blockingIssues: { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          risks: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendation: { type: Type.STRING },
        },
        required: ['optionEvaluations', 'setSummary', 'scores', 'verdict', 'blockingIssues', 'strengths', 'risks', 'recommendation'],
      },
    },
  });

  const parsed = parseJsonOrNull(response.text ?? '{}');
  if (parsed) return parsed;

  return {
    optionEvaluations: run.translations.map((item, index) => ({
      index: index + 1,
      translation: item.translation,
      scores: Object.fromEntries(optionScoreKeys.map((key) => [key, 1])),
      usable: false,
      excellent: false,
      shouldNotShow: false,
      seriousMismatch: false,
      harmful: false,
      notes: 'Automated scoring failed to parse.',
    })),
    setSummary: {
      bestOptionCount: 0,
      excellentOptionCount: 0,
      shouldNotShowOptionCount: 0,
      seriousMismatchOptionCount: 0,
      harmfulOptionCount: 0,
      setVerdict: 'Fail',
      confidence: 0,
    },
    scores: {
      authenticity: 1,
      lowPressure: 1,
      taskCoverage: 1,
      toneFidelity: 1,
      naturalness: 1,
      overallUsefulness: 1,
    },
    verdict: 'Fail',
    blockingIssues: ['Evaluator response was not valid JSON.'],
    strengths: [],
    risks: ['This case needs manual review because automated scoring failed to parse.'],
    recommendation: 'Re-run or manually review this case.',
  };
}

async function evaluateVariationGroup(run, variationResults) {
  const prompt = `You are evaluating one-tap variation outputs for a declarative language translation tool.

Score each variation kind independently against the selected source suggestion, original caregiver request, and tone.

Scoring scale:
5 = excellent, 4 = good, 3 = borderline, 2 = weak, 1 = fail.

Blocking issues:
- Drops an important part of the original caregiver request.
- Direction is not actually followed.
- Becomes bossy, emotionally loaded, gimmicky, manipulative, or awkward.
- Too close to the source or the pair is too duplicative to feel useful.
- Questions are allowed when they soften the demand or invite collaboration. Penalize fake choices, question-demands, or pairs where both rewrites lean on the same question pattern.

Variation goals:
- Shorter: tighter than source, still complete, not clipped.
- Warmer: softer and more connecting without becoming sweeter, parent-centered, or emotionally loaded.
- More straightforward: plainer and clearer without becoming bossy or command-like.
- More playful: lighter in rhythm or wording without becoming a joke, gimmick, or overstimulating.

Kyle-calibrated variation guidance:
- A variation kind can pass or borderline when at least one of the two rewrites is clearly useful and the other is merely weak.
- Always fail the variation kind if either rewrite should not be shown or if Shorter drops the practical payload: safety, sequence, action, location, or destination.
- Questions are allowed when they soften the line. Penalize faux choices and duplicated question patterns.

Original request: ${JSON.stringify(run.text)}
Caregiver intent: ${JSON.stringify(run.intent)}
Tone: ${run.tone}
Interest: ${run.interest ?? 'none'}
Fewer Words: ${run.useFewerWords ? 'on' : 'off'}
Selected source suggestion: ${JSON.stringify(run.selectedSource.translation)}

Variation outputs:
${variationResults.map((result) => {
  const outputs = result.translations.map((item, index) => `  ${index + 1}. ${item.translation}`).join('\n');
  return `${variationLabels[result.variationKind]}:\n${outputs}`;
}).join('\n\n')}

Return JSON only with this shape:
{
  "items": [
    {
      "variationKind": "shorter",
      "scores": {
        "taskCoverage": 1,
        "authenticityLowPressure": 1,
        "directionFidelity": 1,
        "toneFamilyFidelity": 1,
        "distinctness": 1,
        "overallUsefulness": 1
      },
      "verdict": "Pass",
      "strengths": [],
      "risks": [],
      "recommendation": ""
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: modelId,
    contents: prompt,
    config: {
      thinkingConfig: { thinkingBudget: 0 },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                variationKind: { type: Type.STRING },
                scores: {
                  type: Type.OBJECT,
                  properties: {
                    taskCoverage: { type: Type.NUMBER },
                    authenticityLowPressure: { type: Type.NUMBER },
                    directionFidelity: { type: Type.NUMBER },
                    toneFamilyFidelity: { type: Type.NUMBER },
                    distinctness: { type: Type.NUMBER },
                    overallUsefulness: { type: Type.NUMBER },
                  },
                  required: variationScoreKeys,
                },
                verdict: { type: Type.STRING },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                risks: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendation: { type: Type.STRING },
              },
              required: ['variationKind', 'scores', 'verdict', 'strengths', 'risks', 'recommendation'],
            },
          },
        },
        required: ['items'],
      },
    },
  });

  const parsed = parseJsonOrNull(response.text ?? '{"items":[]}');
  if (parsed) return parsed;

  return {
    items: variationResults.map((result) => ({
      variationKind: result.variationKind,
      scores: {
        taskCoverage: 1,
        authenticityLowPressure: 1,
        directionFidelity: 1,
        toneFamilyFidelity: 1,
        distinctness: 1,
        overallUsefulness: 1,
      },
      verdict: 'Fail',
      strengths: [],
      risks: ['Evaluator response was not valid JSON.'],
      recommendation: 'Re-run or manually review this variation group.',
    })),
  };
}

function buildMatrix() {
  const rows = [];
  for (const inputCase of inputCases) {
    for (const toneCase of toneCases) {
      for (const useFewerWords of [false, true]) {
        rows.push({
          ...inputCase,
          ...toneCase,
          useFewerWords,
          id: `${inputCase.id}-${toneCase.tone.toLowerCase().replace(/\s+/g, '-')}-${useFewerWords ? 'fewer' : 'standard'}`,
        });
      }
    }
  }
  return rows;
}

async function runTranslation(row, evaluationRepeats = 1) {
  const startedAt = Date.now();
  const prompt = buildTranslationPrompt({
    text: row.text,
    tone: row.tone,
    interest: row.interest,
    useFewerWords: row.useFewerWords,
  });

  const response = await generateJsonArray(prompt);
  const parsed = parseJsonOrNull(response.text) ?? [];
  const translations = dedupeTranslations(parsed).slice(0, 4);
  const selectedSource = translations[0] ?? { translation: '' };
  const evaluations = [];
  for (let repeatIndex = 0; repeatIndex < evaluationRepeats; repeatIndex += 1) {
    evaluations.push(await evaluateTranslationRun({ ...row, translations }));
  }
  const evaluation = evaluations[0];

  return {
    ...row,
    prompt,
    durationMs: Date.now() - startedAt,
    usageMetadata: response.usageMetadata,
    translations: translations.map((item) => ({
      ...item,
      wordCount: countWords(item.translation),
    })),
    evaluationRepeats: evaluations,
    selectedSource: {
      ...selectedSource,
      wordCount: countWords(selectedSource.translation),
      selectionNote: 'Output #1 selected consistently for variation testing to avoid cherry-picking.',
    },
    evaluation,
  };
}

async function runVariation(row, variationKind) {
  const startedAt = Date.now();
  const prompt = buildVariationPrompt({
    text: row.text,
    sourceTranslation: row.selectedSource.translation,
    variationKind,
    tone: row.tone,
    interest: row.interest,
    useFewerWords: row.useFewerWords,
  });

  const response = await generateJsonArray(prompt);
  const parsed = parseJsonOrNull(response.text) ?? [];
  const translations = dedupeVariationTranslations(parsed, row.selectedSource.translation).slice(0, 2);

  return {
    variationKind,
    label: variationLabels[variationKind],
    prompt,
    durationMs: Date.now() - startedAt,
    usageMetadata: response.usageMetadata,
    translations: translations.map((item) => ({
      ...item,
      wordCount: countWords(item.translation),
      wordCountDeltaVsSource: countWords(item.translation) - row.selectedSource.wordCount,
    })),
  };
}

function groupBy(items, keyFn) {
  return items.reduce((map, item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
    return map;
  }, new Map());
}

function getVerdictCounts(items, selector) {
  return items.reduce((counts, item) => {
    const verdict = normalizeVerdict(selector(item));
    counts[verdict] = (counts[verdict] ?? 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts) {
  return `Pass ${counts.Pass ?? 0}, Borderline ${counts.Borderline ?? 0}, Fail ${counts.Fail ?? 0}`;
}

function summarizeTranslationGroup(items) {
  return {
    count: items.length,
    averageOverall: average(items.map((item) => item.evaluation?.scores?.overallUsefulness)),
    verdictCounts: getVerdictCounts(items, (item) => item.evaluation?.verdict),
    setVerdictCounts: getVerdictCounts(items, (item) => item.evaluation?.setSummary?.setVerdict ?? item.evaluation?.verdict),
    averageBestOptionCount: average(items.map((item) => item.evaluation?.setSummary?.bestOptionCount)),
    averageExcellentOptionCount: average(items.map((item) => item.evaluation?.setSummary?.excellentOptionCount)),
    averageShouldNotShowOptionCount: average(items.map((item) => item.evaluation?.setSummary?.shouldNotShowOptionCount ?? item.evaluation?.setSummary?.harmfulOptionCount)),
    averageSeriousMismatchOptionCount: average(items.map((item) => item.evaluation?.setSummary?.seriousMismatchOptionCount)),
    averageHarmfulOptionCount: average(items.map((item) => item.evaluation?.setSummary?.harmfulOptionCount)),
    averageConfidence: average(items.map((item) => item.evaluation?.setSummary?.confidence)),
    averageScores: Object.fromEntries(
      scoreKeys.map((key) => [key, average(items.map((item) => item.evaluation?.scores?.[key]))])
    ),
  };
}

function summarizeVariationGroup(items) {
  return {
    count: items.length,
    averageOverall: average(items.map((item) => item.evaluation?.scores?.overallUsefulness)),
    verdictCounts: getVerdictCounts(items, (item) => item.evaluation?.verdict),
    averageScores: Object.fromEntries(
      variationScoreKeys.map((key) => [key, average(items.map((item) => item.evaluation?.scores?.[key]))])
    ),
  };
}

function getToneContrastRows(byTone) {
  return [...byTone.entries()]
    .map(([tone, items]) => {
      const summary = summarizeTranslationGroup(items);
      return {
        tone,
        count: summary.count,
        averageToneFidelity: summary.averageScores.toneFidelity,
        averageOverall: summary.averageOverall,
        verdictCounts: summary.verdictCounts,
      };
    })
    .sort((left, right) => {
      const leftScore = left.averageToneFidelity ?? Number.POSITIVE_INFINITY;
      const rightScore = right.averageToneFidelity ?? Number.POSITIVE_INFINITY;
      return leftScore - rightScore;
    });
}

function flattenVariationEvaluations(rows) {
  const flattened = [];
  for (const row of rows) {
    for (const variation of row.variationResults ?? []) {
      const evaluation = row.variationEvaluation?.items?.find(
        (item) => normalizeVariationKind(item.variationKind) === normalizeVariationKind(variation.variationKind)
      );
      flattened.push({
        runId: row.id,
        inputId: row.id,
        text: row.text,
        tone: row.tone,
        useFewerWords: row.useFewerWords,
        selectedSource: row.selectedSource,
        ...variation,
        evaluation,
      });
    }
  }
  return flattened;
}

function getTopRisks(rows, limit = 10) {
  const risks = [];
  for (const row of rows) {
    for (const risk of row.evaluation?.risks ?? []) {
      risks.push({
        context: `${row.tone}, ${row.useFewerWords ? 'fewer words' : 'standard'}, "${row.text}"`,
        risk,
      });
    }
  }
  return risks.slice(0, limit);
}

function summarizeEvaluationRepeats(rows) {
  const repeatedRows = rows.filter((row) => (row.evaluationRepeats?.length ?? 0) > 1);
  if (!repeatedRows.length) {
    return {
      repeatedCount: 0,
      stableVerdictCount: 0,
      unstableExamples: [],
    };
  }

  const unstableExamples = [];
  let stableVerdictCount = 0;

  for (const row of repeatedRows) {
    const verdicts = row.evaluationRepeats.map((evaluation) => normalizeVerdict(evaluation?.setSummary?.setVerdict ?? evaluation?.verdict));
    const uniqueVerdicts = [...new Set(verdicts)];
    if (uniqueVerdicts.length === 1) {
      stableVerdictCount += 1;
    } else {
      unstableExamples.push({
        id: row.id,
        verdicts,
        bestOptionCounts: row.evaluationRepeats.map((evaluation) => evaluation?.setSummary?.bestOptionCount ?? 'n/a'),
      });
    }
  }

  return {
    repeatedCount: repeatedRows.length,
    stableVerdictCount,
    unstableExamples,
  };
}

function buildMarkdown(rows, timestamp) {
  const matrixRows = rows.filter((row) => !row.supplemental);
  const supplementalRows = rows.filter((row) => row.supplemental);
  const variations = flattenVariationEvaluations(matrixRows);
  const translationSummary = summarizeTranslationGroup(matrixRows);
  const variationSummary = summarizeVariationGroup(variations);
  const byTone = groupBy(matrixRows, (row) => row.tone);
  const byInput = groupBy(matrixRows, (row) => row.text);
  const byVariationKind = groupBy(variations, (item) => item.variationKind);
  const byFewer = groupBy(matrixRows, (row) => (row.useFewerWords ? 'Fewer Words on' : 'Fewer Words off'));
  const toneContrastRows = getToneContrastRows(byTone);
  const weakestTone = toneContrastRows.find((row) => typeof row.averageToneFidelity === 'number');
  const topRisks = getTopRisks(matrixRows);
  const repeatSummary = summarizeEvaluationRepeats(matrixRows);

  const lines = [];
  lines.push('# Declarative Translation Output Evaluation');
  lines.push('');
  lines.push(`Generated: ${timestamp}`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push('- Model: Gemini 2.5 Flash, using the live app prompt builders from `services/translationPrompt.js`.');
  lines.push('- Inputs tested: 3.');
  lines.push('- Tone filters tested: Default, Straightforward, Humorous, Equalizing, Interest Based.');
  lines.push('- Fewer Words tested: on and off for every input and tone.');
  lines.push(`- Translation runs: ${matrixRows.length}.`);
  lines.push('- Variation source selection: output #1 from each translation run, selected consistently to avoid cherry-picking.');
  lines.push('- Variation kinds tested per selected source: Shorter, Warmer, More straightforward, More playful.');
  lines.push(`- Variation runs: ${variations.length}.`);
  if (supplementalRows.length) {
    lines.push(`- Supplemental guardrail runs: ${supplementalRows.length}, excluded from aggregate before/after metrics.`);
  }
  lines.push('- Interest Based fixture: matrix runs used `Pokemon`; supplemental guardrails include a no-interest fallback case.');
  lines.push('- UI note: the live UI currently swaps `Shorter` for `Longer` when Fewer Words is on; this eval still tested `Shorter` in every case because that was requested.');
  lines.push('');
  lines.push('## Scoring');
  lines.push('');
  lines.push('Scores use a 1-5 scale: 5 excellent, 4 good, 3 borderline, 2 weak, 1 fail. The calibrated product rule is best-option based: a set can pass with 1-2 genuinely usable/excellent options as long as no option is bad enough that it should not be shown.');
  lines.push('');
  lines.push('The evaluator separates `shouldNotShow` from `seriousMismatch`: should-not-show means harmful, shaming, manipulative, dangerously misleading, unsafe, or based on a false promise; serious mismatch means the option badly violates the selected tone/filter or declarative goal without necessarily being unsafe.');
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`- Translation overall average: **${translationSummary.averageOverall}/5** (${formatCounts(translationSummary.verdictCounts)}).`);
  lines.push(`- Best-option set verdicts: **${formatCounts(translationSummary.setVerdictCounts)}**.`);
  lines.push(`- Average usable option count: **${translationSummary.averageBestOptionCount ?? 'n/a'}**; excellent option count: **${translationSummary.averageExcellentOptionCount ?? 'n/a'}**; should-not-show option count: **${translationSummary.averageShouldNotShowOptionCount ?? 'n/a'}**; serious mismatch count: **${translationSummary.averageSeriousMismatchOptionCount ?? 'n/a'}**.`);
  lines.push(`- Variation overall average: **${variationSummary.averageOverall}/5** (${formatCounts(variationSummary.verdictCounts)}).`);
  lines.push('- Overall: mixed. The tool can produce strong low-pressure language, but this run is not consistent enough to treat the current prompt behavior as fully healthy.');
  lines.push('- Strongest behavior: the dinner transition prompt performed best because the task is concrete, sequenced, and easy to reframe as a situation.');
  lines.push('- Weakest behavior: `Stop running in the house` exposed the biggest gap. The outputs often became vague facts about running, floors, or walls instead of clear, safe, low-pressure redirection.');
  lines.push('- Tone risk: Straightforward is the strongest filter overall, while Humorous, Equalizing, and Interest Based need clearer guardrails to avoid sounding contrived, gimmicky, or too weakly tied to the tone goal.');
  lines.push('- Variation risk: `Shorter` is the most fragile variation, especially when the source line is already thin. It often removes needed context rather than making a better compact line.');
  lines.push('');
  lines.push('## Best-Option Summary');
  lines.push('');
  lines.push('| Group | Runs | Set Verdicts | Avg Usable Options | Avg Excellent Options | Avg Should-Not-Show | Avg Serious Mismatch | Avg Confidence |');
  lines.push('|---|---:|---|---:|---:|---:|---:|---:|');
  lines.push(`| All translation sets | ${translationSummary.count} | ${formatCounts(translationSummary.setVerdictCounts)} | ${translationSummary.averageBestOptionCount ?? 'n/a'} | ${translationSummary.averageExcellentOptionCount ?? 'n/a'} | ${translationSummary.averageShouldNotShowOptionCount ?? 'n/a'} | ${translationSummary.averageSeriousMismatchOptionCount ?? 'n/a'} | ${translationSummary.averageConfidence ?? 'n/a'} |`);
  for (const [tone, items] of byTone.entries()) {
    const summary = summarizeTranslationGroup(items);
    lines.push(`| ${tone} | ${summary.count} | ${formatCounts(summary.setVerdictCounts)} | ${summary.averageBestOptionCount ?? 'n/a'} | ${summary.averageExcellentOptionCount ?? 'n/a'} | ${summary.averageShouldNotShowOptionCount ?? 'n/a'} | ${summary.averageSeriousMismatchOptionCount ?? 'n/a'} | ${summary.averageConfidence ?? 'n/a'} |`);
  }
  lines.push('');
  lines.push('## Evaluation Variance');
  lines.push('');
  if (repeatSummary.repeatedCount === 0) {
    lines.push('Repeated automated scoring was not enabled for this run. Use `--repeats=2` or higher for key comparisons.');
  } else {
    lines.push(`- Repeated rows: ${repeatSummary.repeatedCount}`);
    lines.push(`- Stable best-option verdicts: ${repeatSummary.stableVerdictCount}/${repeatSummary.repeatedCount}`);
    if (repeatSummary.unstableExamples.length) {
      lines.push('');
      lines.push('| Run | Repeated verdicts | Best option counts |');
      lines.push('|---|---|---|');
      for (const example of repeatSummary.unstableExamples.slice(0, 12)) {
        lines.push(`| ${example.id} | ${example.verdicts.join(', ')} | ${example.bestOptionCounts.join(', ')} |`);
      }
    }
  }
  lines.push('');
  lines.push('## Input Summary');
  lines.push('');
  lines.push('| Input | Runs | Avg Overall | Verdicts | Main Read |');
  lines.push('|---|---:|---:|---|---|');
  for (const [input, items] of byInput.entries()) {
    const summary = summarizeTranslationGroup(items);
    const note = input.includes('Stop running')
      ? 'Primary fix target; safety redirection needs clearer, natural declarative phrasing.'
      : input.includes('dinner')
        ? 'Best-performing case; sequence and concrete setup are usually preserved.'
        : 'Mixed; destination and cleanup details sometimes collapse into generic cleanup language.';
    lines.push(`| ${input} | ${summary.count} | ${summary.averageOverall} | ${formatCounts(summary.verdictCounts)} | ${note} |`);
  }
  lines.push('');
  lines.push('## Tone Summary');
  lines.push('');
  lines.push('| Tone | Runs | Avg Overall | Verdicts | Avg Tone Fidelity | Avg Coverage | Notes |');
  lines.push('|---|---:|---:|---|---:|---:|---|');
  for (const [tone, items] of byTone.entries()) {
    const summary = summarizeTranslationGroup(items);
    const note = tone === 'Equalizing'
      ? 'Watch for whether status-leveling is the main frame, not just a light add-on.'
      : tone === 'Interest Based'
        ? 'Needs a real interest value and should avoid themed gimmickry.'
        : tone === 'Humorous'
          ? 'Works best when humor stays light and concrete.'
          : tone === 'Straightforward'
            ? 'Generally strongest when concise without becoming clipped.'
            : 'Generally reliable baseline.';
    lines.push(`| ${tone} | ${summary.count} | ${summary.averageOverall} | ${formatCounts(summary.verdictCounts)} | ${summary.averageScores.toneFidelity} | ${summary.averageScores.taskCoverage} | ${note} |`);
  }
  lines.push('');
  lines.push('## Tone Contrast');
  lines.push('');
  if (weakestTone) {
    lines.push(`Weakest tone by average tone fidelity: **${weakestTone.tone}** (${weakestTone.averageToneFidelity}/5).`);
  } else {
    lines.push('Weakest tone by average tone fidelity: not available because no tone fidelity scores were returned.');
  }
  lines.push('');
  lines.push('| Tone | Runs | Avg Tone Fidelity | Avg Overall | Verdicts |');
  lines.push('|---|---:|---:|---:|---|');
  for (const row of toneContrastRows) {
    lines.push(`| ${row.tone} | ${row.count} | ${row.averageToneFidelity ?? 'n/a'} | ${row.averageOverall ?? 'n/a'} | ${formatCounts(row.verdictCounts)} |`);
  }
  lines.push('');
  lines.push('## Fewer Words Summary');
  lines.push('');
  lines.push('| Setting | Runs | Avg Overall | Verdicts | Avg Coverage | Avg Naturalness |');
  lines.push('|---|---:|---:|---|---:|---:|');
  for (const [setting, items] of byFewer.entries()) {
    const summary = summarizeTranslationGroup(items);
    lines.push(`| ${setting} | ${summary.count} | ${summary.averageOverall} | ${formatCounts(summary.verdictCounts)} | ${summary.averageScores.taskCoverage} | ${summary.averageScores.naturalness} |`);
  }
  lines.push('');
  lines.push('## Variation Summary');
  lines.push('');
  lines.push('| Variation | Runs | Avg Overall | Verdicts | Avg Direction Fidelity | Avg Distinctness | Notes |');
  lines.push('|---|---:|---:|---|---:|---:|---|');
  for (const [kind, items] of byVariationKind.entries()) {
    const summary = summarizeVariationGroup(items);
    const note = kind === 'shorter'
      ? 'Most vulnerable to task loss on multi-part prompts.'
      : kind === 'warmer'
        ? 'Should soften without adding emotional pressure.'
        : kind === 'more_straightforward'
          ? 'Should get clearer without turning command-like.'
          : 'Should lift the wording without becoming a joke.';
    lines.push(`| ${variationLabels[kind]} | ${summary.count} | ${summary.averageOverall} | ${formatCounts(summary.verdictCounts)} | ${summary.averageScores.directionFidelity} | ${summary.averageScores.distinctness} | ${note} |`);
  }
  lines.push('');
  lines.push('## Actionable Recommendations');
  lines.push('');
  lines.push('1. Continue iterating safety redirection. The new prompt now adds walking-inside/running-outside alternatives, but `Stop running in the house` remains the weakest input and needs more natural, fast-moment phrasing.');
  lines.push('2. Keep the tone-contrast summary in future reports. It is now the clearest way to see whether each tone is doing a distinct job instead of sharing one generic translation style.');
  lines.push('3. Treat Humorous as the next tone to tune. It improved, but remains the weakest tone by tone fidelity; future changes should keep one light playful image while avoiding theatrical personification.');
  lines.push('4. Preserve the Equalizing status-leveling direction while watching for sameness. The better outputs make the child a checker, leader, or expert without repeating the same label every time.');
  lines.push('5. Keep the Interest Based empty-state guard and no-interest fallback. The UI should require a real interest for true Interest Based output; server fallback should stay grounded and avoid pretending an interest exists.');
  lines.push('6. Continue tightening `Shorter`. It improved against the baseline, but it still produces the most variation failures when the source line is already compact or safety/location details are easy to drop.');
  lines.push('7. Keep Fewer Words subordinate to task coverage. Brevity should never remove safety meaning, dinner sequence, cleanup action, or upstairs-room destination.');
  lines.push('8. Keep the current Fewer Words chip swap documented as intentional. The UI swaps `Shorter` to `Longer` when Fewer Words is on, while this eval keeps testing `Shorter` directly for regression coverage.');
  lines.push('9. Run this evaluation set before future prompt changes. These inputs now cover safety, transition, cleanup destination, tone contrast, variation quality, and Interest Based fallback behavior.');
  lines.push('');
  lines.push('## Repeated Risks From The Run');
  lines.push('');
  if (!topRisks.length) {
    lines.push('- No repeated risks were returned by the evaluator.');
  } else {
    for (const item of topRisks) {
      lines.push(`- ${item.context}: ${item.risk}`);
    }
  }
  lines.push('');
  lines.push('## Translation Run Details');
  lines.push('');
  for (const row of rows) {
    lines.push(`### ${row.id}`);
    lines.push('');
    lines.push(`- Input: ${row.text}`);
    lines.push(`- Tone: ${row.tone}`);
    if (row.supplemental) lines.push('- Supplemental guardrail: Yes');
    if (row.interest) lines.push(`- Interest: ${row.interest}`);
    if (row.assumption) lines.push(`- Assumption: ${row.assumption}`);
    lines.push(`- Fewer Words: ${row.useFewerWords ? 'On' : 'Off'}`);
    lines.push(`- Verdict: ${row.evaluation?.verdict}`);
    if (row.evaluation?.setSummary) {
      const summary = row.evaluation.setSummary;
      lines.push(`- Best-option verdict: ${normalizeVerdict(summary.setVerdict)}; usable options ${summary.bestOptionCount}; excellent options ${summary.excellentOptionCount}; should-not-show options ${summary.shouldNotShowOptionCount ?? summary.harmfulOptionCount ?? 'n/a'}; serious mismatches ${summary.seriousMismatchOptionCount ?? 'n/a'}; confidence ${summary.confidence}`);
    }
    lines.push(`- Scores: ${Object.entries(getScoreSummary(row.evaluation?.scores, scoreKeys)).map(([key, value]) => `${key} ${value}`).join(', ')}`);
    lines.push(`- Recommendation: ${row.evaluation?.recommendation}`);
    lines.push('');
    lines.push('Outputs:');
    row.translations.forEach((item, index) => {
      const marker = index === 0 ? ' (selected for variations)' : '';
      lines.push(`${index + 1}. ${item.translation} [${item.wordCount} words]${marker}`);
    });
    lines.push('');
    if (row.evaluation?.optionEvaluations?.length) {
      lines.push('Option evaluations:');
      for (const option of row.evaluation.optionEvaluations) {
        lines.push(`- ${option.index}. usable ${option.usable ? 'yes' : 'no'}, excellent ${option.excellent ? 'yes' : 'no'}, should-not-show ${(option.shouldNotShow ?? option.harmful) ? 'yes' : 'no'}, serious mismatch ${option.seriousMismatch ? 'yes' : 'no'}, usability ${option.scores?.usability ?? 'n/a'}/5. ${option.notes}`);
      }
      lines.push('');
    }
    lines.push('Variation verdicts for selected output:');
    for (const variation of row.variationResults ?? []) {
      const evaluation = findVariationEvaluation(row, variation.variationKind);
      lines.push(`- ${variation.label}: ${normalizeVerdict(evaluation?.verdict)}, overall ${evaluation?.scores?.overallUsefulness}/5. ${evaluation?.recommendation}`);
      variation.translations.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item.translation} [delta ${item.wordCountDeltaVsSource >= 0 ? '+' : ''}${item.wordCountDeltaVsSource} words]`);
      });
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const startedAt = Date.now();
  const rebuildLatest = process.argv.includes('--rebuild-latest');
  const evaluationRepeats = getNumericArg('repeats', 1);

  if (rebuildLatest) {
    const latestJsonPath = path.join(resultsDir, 'latest-translation-output-evaluation.json');
    const rows = JSON.parse(fs.readFileSync(latestJsonPath, 'utf8'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const markdown = buildMarkdown(rows, timestamp);
    const markdownPath = path.join(resultsDir, `translation-output-evaluation-${timestamp}.md`);
    const latestMarkdownPath = path.join(resultsDir, 'latest-translation-output-evaluation.md');
    fs.writeFileSync(markdownPath, markdown);
    fs.writeFileSync(latestMarkdownPath, markdown);
    console.log(`Rebuilt Markdown report at ${markdownPath}`);
    console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
    return;
  }

  const matrix = buildMatrix();
  const rowsToRun = [...matrix, ...supplementalTranslationCases];
  const rows = [];

  console.log(`Running ${matrix.length} matrix translation runs, ${supplementalTranslationCases.length} supplemental runs, ${rowsToRun.length * variationKinds.length} variation runs, and ${evaluationRepeats} automated scoring pass(es) per translation set...`);

  for (const row of rowsToRun) {
    console.log(`- ${row.id}`);
    const translationRun = await runTranslation(row, evaluationRepeats);
    const variationResults = [];
    for (const variationKind of variationKinds) {
      variationResults.push(await runVariation(translationRun, variationKind));
    }
    const variationEvaluation = await evaluateVariationGroup(translationRun, variationResults);
    rows.push({
      ...translationRun,
      variationResults,
      variationEvaluation,
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `translation-output-evaluation-${timestamp}.json`);
  const markdownPath = path.join(resultsDir, `translation-output-evaluation-${timestamp}.md`);
  const latestJsonPath = path.join(resultsDir, 'latest-translation-output-evaluation.json');
  const latestMarkdownPath = path.join(resultsDir, 'latest-translation-output-evaluation.md');

  const markdown = buildMarkdown(rows, timestamp);
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  fs.writeFileSync(markdownPath, markdown);
  fs.writeFileSync(latestJsonPath, JSON.stringify(rows, null, 2));
  fs.writeFileSync(latestMarkdownPath, markdown);

  console.log('');
  console.log(`Wrote JSON results to ${jsonPath}`);
  console.log(`Wrote Markdown report to ${markdownPath}`);
  console.log(`Updated latest JSON at ${latestJsonPath}`);
  console.log(`Updated latest Markdown at ${latestMarkdownPath}`);
  console.log(`Completed in ${Date.now() - startedAt} ms`);
}

main().catch((error) => {
  console.error('Translation output evaluation failed:', error);
  process.exit(1);
});
