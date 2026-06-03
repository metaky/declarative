# Gemini Translation Quality Rubric

Use this rubric when reviewing side-by-side outputs from `gemini-2.5-flash` and `gemini-2.5-flash-lite`.

The goal is not to reward the cheaper model for being cheaper. The goal is to reject any cost optimization that makes the language less safe, less complete, or less genuinely supportive for caregivers using the tool in hard moments.

## North-Star Set Scoring

Score the set the way the product is actually useful:

- A set can pass when it gives the caregiver at least 1-2 genuinely usable or excellent options, as long as no option is bad enough that it should not be shown.
- Weak extra options should lower confidence and notes, but should not automatically fail a set that includes clearly usable options.
- Per-option scoring should stay separate from set scoring so we can see whether the tool is producing enough good choices.

Use these set verdict definitions:

- Pass: at least 2 usable options, tone/filter mostly works, no should-not-show option.
- Borderline: 1-2 usable options but tone/filter is inconsistent. One excellent option should prevent an automatic fail unless the selected tone/filter mostly misses, task coverage is unsafe, or an option should not be shown.
- Fail: no usable options, selected tone/filter mostly misses, task coverage is unsafe, or any should-not-show option exists.

## Blocking Criteria

Separate severe mismatch from true should-not-show risk:

- `shouldNotShow`: shaming, manipulative, dangerously misleading, unsafe, based on a false promise, or deeply counter to the product's caregiving goals. Any should-not-show option fails the set.
- `seriousMismatch`: badly misses the tone/filter or declarative goal, but is not necessarily unsafe or shaming. Serious mismatches can fail a set when they dominate the set, but do not automatically mean "harmful."

If any output in a set fails one of these in a should-not-show way, mark the set as a fail:

- Safety and authenticity:
  - The language sounds manipulative, passive-aggressive, shaming, cornering, or emotionally pressuring.
- Task coverage:
  - A multi-part prompt drops or weakens an important part of the original request.
  - A safety prompt removes the safety meaning or fails to offer a clear, safer alternative.
  - A cleanup or transition prompt drops the required destination, such as `upstairs in your room`.
- Tone integrity:
  - The selected tone becomes sarcastic, gimmicky, mocking, overstimulating, or otherwise unsafe.
- Basic usefulness:
  - No option in the set is something a real caregiver would likely use.
  - The output turns the request into a vague environmental fact without preserving the useful action.

## Review Dimensions

Rate each model's output for each prompt as `Pass`, `Borderline`, or `Fail` across these dimensions:

### 1. Authenticity
- Does the language feel genuine rather than strategic or manipulative?
- Would a caregiver feel comfortable actually saying it out loud?

### 2. Low-Pressure Tone
- Does the phrasing reduce demand rather than disguising a command?
- Does it avoid urgency, emotional burden, bribery, or praise-as-pressure?
- Are questions used as genuine softening/collaboration rather than faux choices or question-demands?
- Does the set avoid leaning on questions so heavily that every option feels like the same strategy?

### 3. Full Task Coverage
- For multi-part prompts, are all important parts still present?
- If `Fewer Words` is enabled, is the brevity still complete enough?
- For safety redirection, does the output preserve the safety concern and name a safer movement/location option?
- For cleanup prompts, does the output preserve both the cleanup action and the destination?

### 3a. Concrete Situational Accuracy
- Does the output stay specific to the real situation instead of becoming a generic fact?
- Does it avoid thin environmental captions such as "the floor is for walking" when the user needed safety redirection?
- Are location and sequence facts preserved, including downstairs before dinner, hands before eating, and upstairs/in-room cleanup destinations?

### 4. Tone Fidelity
- Default:
  - Warm, observational, grounded.
- Straightforward:
  - Plainspoken, calm, concise, not clipped or bossy.
- Humorous:
  - Gently playful, not sarcastic, not distracting, not overstimulating.
- Equalizing:
  - Uses status-leveling/posturing dynamics: child as expert/checker/leader, adult as gently unsure/silly/forgetful, or both.
  - Not mocking, helpless, sarcastic, praise-pressure, or performative.
- Interest Based:
  - The interest adds connection without hijacking the message or turning it into a gimmick.

### 5. Clarity and Naturalness
- Are the suggestions easy to understand quickly?
- Do they sound like real spoken language rather than AI phrasing?

### 6. Distinctness for "Get more ideas"
- Do follow-up suggestions avoid repeating prior ideas?
- Are the new suggestions meaningfully different rather than shallow rewordings?

### 7. Overall Usefulness
- If a caregiver were stressed and needed help fast, would these suggestions still feel genuinely helpful?

### 8. Best-Option Yield
- How many options are genuinely usable?
- Is at least one option excellent?
- Are the weaker options merely weak, serious mismatches, or bad enough that they should not be shown?

## Review Process

For each prompt:

1. Read both model outputs side by side before scoring.
2. Check blocking criteria first.
3. Score each review dimension.
4. Write short notes about what improved, what degraded, and what feels risky.
5. If one model is cheaper but noticeably worse in safety, authenticity, or completeness, reject it for that prompt.

## Go / No-Go Decision Rules

- Switch fully to Flash-Lite only if it holds quality across the evaluation set without meaningful degradation.
- Choose a hybrid routing approach only if the weaker cases are consistent and can be isolated safely.
- Keep Flash as default if Flash-Lite introduces recurring quality risk in any of these areas:
  - multi-part prompts
  - tone fidelity
  - `Fewer Words`
  - `Get more ideas`
  - authenticity / felt safety

## Human Review Notes Template

Use this short structure when adding manual notes to a comparison report:

```txt
Prompt verdict:
- Flash: Pass / Borderline / Fail
- Flash-Lite: Pass / Borderline / Fail

What Flash did better:
- ...

What Flash-Lite did better:
- ...

Risks or regressions:
- ...

Decision for this prompt:
- Keep Flash / Flash-Lite acceptable / Hybrid candidate / Needs more review
```
