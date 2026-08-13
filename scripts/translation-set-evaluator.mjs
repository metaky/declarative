import { Type } from '@google/genai';

export const DEFAULT_EVALUATOR_MODEL = 'gemini-2.5-flash';

export const scoreKeys = [
  'authenticity',
  'lowPressure',
  'taskCoverage',
  'toneFidelity',
  'naturalness',
  'overallUsefulness',
];

export const optionScoreKeys = [
  'authenticity',
  'lowPressure',
  'taskCoverage',
  'toneFidelity',
  'naturalness',
  'usability',
];

export function stripToJson(text) {
  const trimmed = String(text ?? '').trim();
  if (trimmed.startsWith('```')) {
    return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return trimmed;
}

export function parseJsonOrNull(text) {
  try {
    return JSON.parse(stripToJson(text));
  } catch {
    return null;
  }
}

export function buildTranslationEvaluationPrompt(item) {
  return `You are evaluating a declarative language translation tool for PDA/neurodivergent caregiving contexts.

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
- Questions are allowed and often soften demands. Do not penalize question marks by themselves. Penalize only fake choices, question-demands, or overuse where every option becomes the same question strategy. Equalizing + Fewer Words can rely more heavily on compact questions when that is the most natural way to make the child the checker, expert, or leader.

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

Tone goals:
- Default: warm, grounded, observational, everyday wording.
- Straightforward: plainspoken, concise, calm, not clipped or bossy.
- Humorous: gently playful, not sarcastic, not distracting, not overstimulating.
- Equalizing: makes status-leveling the frame; child as expert/checker/leader, adult as gently unsure/silly/forgetful, with dignity.
- Interest Based: every option uses the entered interest or a recognizable element from it in a way that logically connects to the task without becoming a gimmick.

Original request: ${JSON.stringify(item.text)}
Caregiver intent: ${JSON.stringify(item.intent ?? '')}
Tone: ${item.tone}
Interest: ${item.interest ?? 'none'}
Fewer Words: ${item.useFewerWords ? 'on' : 'off'}
Translations:
${(item.translations ?? []).map((translation, index) => `${index + 1}. ${translation.translation}`).join('\n')}

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
}

export function translationEvaluationResponseSchema() {
  return {
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
  };
}

export async function evaluateTranslationSet(ai, item, options = {}) {
  const model = options.model ?? DEFAULT_EVALUATOR_MODEL;
  const thinkingBudget = options.thinkingBudget ?? 0;
  const maxOutputTokens = options.maxOutputTokens;
  const response = await ai.models.generateContent({
    model,
    contents: buildTranslationEvaluationPrompt(item),
    config: {
      thinkingConfig: { thinkingBudget },
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      responseMimeType: 'application/json',
      responseSchema: translationEvaluationResponseSchema(),
    },
  });

  return {
    evaluation: parseJsonOrNull(response.text ?? '{}'),
    usageMetadata: response.usageMetadata ?? null,
    evaluatorModel: model,
  };
}
