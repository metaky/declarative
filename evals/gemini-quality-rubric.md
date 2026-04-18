# Gemini Translation Quality Rubric

Use this rubric when reviewing side-by-side outputs from `gemini-2.5-flash` and `gemini-2.5-flash-lite`.

The goal is not to reward the cheaper model for being cheaper. The goal is to reject any cost optimization that makes the language less safe, less complete, or less genuinely supportive for caregivers using the tool in hard moments.

## Blocking Criteria

If either model fails any of these on a prompt, mark it as a fail for that prompt:

- Safety and authenticity:
  - The language sounds manipulative, passive-aggressive, shaming, cornering, or emotionally pressuring.
- Task coverage:
  - A multi-part prompt drops or weakens an important part of the original request.
- Tone integrity:
  - The selected tone becomes sarcastic, gimmicky, mocking, overstimulating, or otherwise unsafe.
- Basic usefulness:
  - The output is confusing, awkward, or so unnatural that a real caregiver would be unlikely to use it.

## Review Dimensions

Rate each model's output for each prompt as `Pass`, `Borderline`, or `Fail` across these dimensions:

### 1. Authenticity
- Does the language feel genuine rather than strategic or manipulative?
- Would a caregiver feel comfortable actually saying it out loud?

### 2. Low-Pressure Tone
- Does the phrasing reduce demand rather than disguising a command?
- Does it avoid urgency, emotional burden, bribery, or praise-as-pressure?

### 3. Full Task Coverage
- For multi-part prompts, are all important parts still present?
- If `Fewer Words` is enabled, is the brevity still complete enough?

### 4. Tone Fidelity
- Default:
  - Warm, observational, grounded.
- Straightforward:
  - Plainspoken, calm, concise, not clipped or bossy.
- Humorous:
  - Gently playful, not sarcastic, not distracting, not overstimulating.
- Equalizing:
  - Collaborative and leveling, not mocking, not helpless, not performative.
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
