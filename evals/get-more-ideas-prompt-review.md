# Get More Ideas Prompt Review

This document captures the exact `Get more ideas` prompt shape used today, why it likely degrades quality, and what prompt-level changes we should test before changing the implementation. The goal is to improve distinctness and usefulness without making the follow-up suggestions feel pushier, more generic, or less complete.

## Current flow

### Frontend behavior

When a user clicks `Get more ideas`, the frontend sends the original request text plus the full list of previously returned translations back to the API.

Relevant code:
- [components/Translator.tsx](/Users/kyle.wegner/Dev%20Projects/declarative/components/Translator.tsx:269)
- [services/geminiService.ts](/Users/kyle.wegner/Dev%20Projects/declarative/services/geminiService.ts:49)

The important behavior is:
- The original caregiver request stays the same.
- Every prior translation is resent in the request body as `existingTranslations`.
- The follow-up call uses the same tone and `Fewer Words` settings as the initial run.

### Server-side prompt assembly

The server uses the same shared prompt builder for the initial request and the follow-up request.

Relevant code:
- [services/translationPrompt.js](/Users/kyle.wegner/Dev%20Projects/declarative/services/translationPrompt.js:21)

For follow-up requests, the prompt builder appends this extra instruction:

```text
Avoid repeating these specific ideas: <translation 1>, <translation 2>, <translation 3>, ...
```

That means the model receives:
- the full original caregiver request
- the full tone instruction
- the `Fewer Words` instruction when enabled
- a comma-separated list of all previous translations

## Current prompt shape

The current follow-up request is effectively:

```text
Rewrite this statement into 3-4 declarative alternatives that preserve the full meaning while reducing pressure: "<original text>". Ensure all parts of the user's request are addressed gracefully in each suggestion. Lead with environment-first or task-first observations whenever possible rather than caregiver-centered phrasing. At least 3 of the 4 suggestions should begin with objective observations about the environment, task, timing, sensory context, or situation rather than with caregiver-first language. Avoid starting multiple suggestions with "I", "I'm", "I am", "my", "we", or "our". Tone: <tone instruction>. <optional fewer-words instruction>. Avoid repeating these specific ideas: <all earlier translations joined into one line>
```

## Why this likely hurts quality

### 1. The prompt gives a negative constraint but not a positive novelty strategy

The model is told what not to repeat, but it is not told how to produce fresh alternatives. That often pushes models toward:
- safer but vaguer wording
- shallow synonym swaps
- generic observation openers
- lower-risk but less useful suggestions

### 2. Resending the full prior outputs creates strong anchoring

By pasting the earlier translations verbatim, we are reminding the model of the exact language it already used. That can backfire:
- the model stays semantically close to the old suggestions
- it becomes overly cautious about overlap
- it backs away from specific phrasing and drifts into generic alternatives

### 3. A comma-separated list is a weak format for nuanced deduplication

The prior ideas are flattened into one long line instead of being separated into distinct concepts or patterns. That makes it harder for the model to reason about:
- which ideas are truly duplicates
- which openings or structures have already been used
- which parts of the meaning still need new angles

### 4. The current prompt does not require structural variety across rounds

The follow-up request does not explicitly ask for:
- new opening patterns
- different emotional distance
- different collaborative angles
- different observation types

So even when wording changes, the outputs can still feel like the same idea wearing different clothes.

### 5. Multi-part requests are especially vulnerable

When the model is trying to avoid every earlier suggestion, it can start compressing the request too aggressively. That makes it more likely to:
- drop one part of a multi-part request
- blur the task into something more abstract
- produce shorter but less complete alternatives

## Prompt-level improvements to test before implementation

These are the changes worth testing before we rewrite the flow itself.

### 1. Tell the model what kind of novelty we want

Add explicit follow-up guidance such as:
- generate fresh alternatives that use different openings or angles from the earlier suggestions
- do not merely swap synonyms into the same core sentence
- keep each new option meaningfully distinct in structure or framing

Why this matters:
- it gives the model a positive target instead of only a prohibition
- it should improve distinctness without encouraging weirdness or gimmicks

### 2. Ask for new angles, not just new wording

We should guide follow-up suggestions to vary by framing, for example:
- one more environment-first observation
- one collaborative problem-solving angle
- one gentle timing or sensory cue
- one lightly self-narrated option when natural

Why this matters:
- it encourages real variety
- it gives the model permission to explore fresh structures while staying within the product voice

### 3. Explicitly protect multi-part completeness

The follow-up prompt should restate that every new suggestion must still preserve all important parts of the original request, even when trying to avoid overlap with earlier suggestions.

Why this matters:
- it keeps novelty from winning at the expense of usefulness
- it protects one of the most quality-sensitive parts of the product

### 4. Explicitly protect authenticity and low-pressure tone in follow-ups

The follow-up prompt should remind the model that "different" does not mean:
- more emotionally loaded
- more praising
- more performative
- more manipulative

Why this matters:
- some of the weaker follow-up outputs become warmer in a way that can feel subtly pressuring
- this guardrail matters as much in round two and round three as it does in the first response

### 5. Eventually send a more compact summary of prior ideas instead of the full lines

This is more of a Step 7 implementation change than a pure Step 6 prompt change, but it should stay in scope for testing.

Possible direction:
- summarize prior ideas into short "already-covered angles"
- or keep only the minimum phrases needed to block obvious duplicates

Why this matters:
- it reduces prompt bloat
- it reduces lexical anchoring on the exact old wording
- it should make later rounds cheaper

## Proposed follow-up prompt guidance

This is the prompt direction I recommend testing next. It keeps the existing core prompt but replaces the weak follow-up instruction with more specific guidance about novelty, completeness, and tone.

### Current follow-up add-on

```text
Avoid repeating these specific ideas: <all earlier translations joined into one line>
```

### Proposed follow-up add-on

```text
These earlier suggestions have already been shown to the user: <all earlier translations joined into one line>

Generate 3-4 new declarative alternatives that feel meaningfully different from those earlier suggestions in structure, framing, or opening angle, not just in word choice.
Avoid obvious repeats, near-duplicates, and shallow synonym swaps.
Keep every new suggestion authentic, low-pressure, and useful in a real caregiver moment.
Different must not mean more emotionally loaded, more praising, more performative, or more manipulative.
If the original request has multiple important parts, preserve all of them in every new suggestion.
Vary the follow-up set across different angles when natural, such as environment-first observation, timing cue, collaborative problem-solving, or another grounded declarative frame.
```

### Refined follow-up add-on for the next iteration

```text
These earlier suggestions have already been shown to the user: <all earlier translations joined into one line>

Generate 3-4 new declarative alternatives that are meaningfully different from the earlier suggestions in framing and sentence shape, not just in word choice.
Treat the earlier suggestions as already covered. Do not reuse their core sentence patterns.
Avoid obvious repeats, near-duplicates, shallow synonym swaps, and generic fallback phrasing.

Across the 3-4 new suggestions, vary the framing on purpose:
- one can foreground the environment or location
- one can foreground the sequence or transition between parts
- one can foreground a practical setup or object involved
- one can foreground a calm collaborative or matter-of-fact shared perspective

Do not let multiple new suggestions use the same opening pattern or the same sentence skeleton.
Avoid overusing generic frames such as "it's time for...", "X is ready", "X is next", "after that...", or "I wonder..." unless one of them is unusually natural and clearly different from the earlier set.

Keep every suggestion authentic, low-pressure, and useful in a real caregiver moment.
Different must not mean more emotionally loaded, more praising, more performative, or more manipulative.
If the original request has multiple important parts, preserve all of them in every suggestion.
Stay grounded in the same real situation. Do not invent playful details, emotional stakes, or extra context just to make the lines feel new.
```

### More concrete follow-up add-on for the next iteration after that

```text
These earlier suggestions have already been shown to the user: <all earlier translations joined into one line>

First, silently notice the main patterns already used in those earlier suggestions so you can avoid repeating them. Then write only the JSON answer.

Generate 4 new declarative alternatives that are genuinely different from the earlier suggestions in both angle and sentence shape, not just in wording.
Treat the earlier suggestions as fully covered. Do not reuse their core sentence patterns, opening moves, or closing moves.
Avoid obvious repeats, near-duplicates, shallow synonym swaps, and generic fallback phrasing.

Make the 4 new suggestions intentionally different from each other:
- Suggestion 1: foreground a concrete place, object, or visible setup in the situation.
- Suggestion 2: foreground the sequence, path, or transition from one part to the next.
- Suggestion 3: foreground a practical support or matter-of-fact piece of logistics that helps the moment move along.
- Suggestion 4: foreground a calm shared perspective, but keep it natural and do not make it emotionally loaded.

Do not let multiple suggestions use the same sentence skeleton.
Avoid generic frames such as "it's time for...", "X is ready", "X is next", "after that...", "it looks like...", or "I wonder..." unless one appears once and feels unusually natural.
Use different opening words for each suggestion.

Keep every suggestion authentic, low-pressure, and useful in a real caregiver moment.
Different must not mean more emotionally loaded, more praising, more performative, or more manipulative.
If the original request has multiple important parts, preserve all of them in every suggestion.
Stay grounded in the same real situation. Do not invent playful details, emotional stakes, or extra context just to make the lines feel new.
```

## Why this proposal is stronger

### It gives the model a positive job

Instead of only saying "don't repeat," the revised add-on says what success looks like:
- meaningfully different structure
- different opening angle
- grounded real-world usefulness

That should reduce the model's tendency to retreat into generic filler language.

### It defines bad novelty explicitly

The weakest follow-up outputs usually fail in one of two ways:
- they repeat the same idea with cosmetic wording changes
- they become "creative" in a way that feels less natural or less safe

The revised add-on blocks both failure modes directly.

### It protects quality in the places that matter most

The proposed language explicitly protects:
- authenticity
- low-pressure tone
- multi-part completeness
- usefulness in a real caregiver moment

Those are the criteria we care about most, so they should be named directly in the prompt.

### It encourages structured variety without making the model gimmicky

The "vary the follow-up set across different angles" line is important because it nudges the model toward real variation, but the examples stay grounded:
- environment-first observation
- timing cue
- collaborative problem-solving
- another grounded declarative frame

That should create more variety without pushing the model toward humor, performance, or novelty for novelty's sake.

## Practical recommendation for the next test

Before we change production behavior, use the proposed follow-up add-on in a prompt experiment that keeps everything else the same:
- same base system instruction
- same tone overlays
- same output format
- same existing list of prior translations

That will let us isolate whether better follow-up guidance alone improves quality.

If that prompt-only change improves distinctness without hurting authenticity or completeness, then we can decide whether Step 7 should:
- keep the full prior translations but with better guidance
- send a shorter summary of prior ideas
- or combine both improvements

For the next iteration, prefer the refined add-on above over the first proposed add-on. The first proposal improved the theory of the prompt, but it still left too much room for the model to fall back to generic sentence shapes. The refined version is more explicit about what should differ between outputs and what kinds of stock phrasing should be avoided.

If the refined version still produces stock declarative sentence shapes, move to the more concrete add-on above. Its main advantage is that it stops asking the model to "be different" in a vague way and instead assigns four different jobs to the four follow-up suggestions. That should make it easier for the model to understand what can and should differ between results.

## Approval bar for this proposal

I would only approve this direction if the test results show all of the following:
- clearly better distinctness between initial and follow-up suggestions
- no noticeable increase in generic language
- no increase in praise-heavy, emotionally loaded, or subtly pressuring language
- no loss of completeness on multi-part prompts
- no tone drift in Interest Based or `Fewer Words` follow-up cases

## Recommended test plan for the prompt review step

Before implementation, test a revised follow-up prompt on representative cases:
- one Default case
- one Interest Based case
- one multi-part case
- one `Fewer Words` case

For each case, review:
- distinctness from earlier suggestions
- preservation of all parts of the original request
- tone fidelity
- authenticity
- non-manipulativeness
- usefulness in a real caregiver moment

## Decision standard

We should only move the revised follow-up prompt into implementation if it clearly improves at least these three things at once:
- the suggestions feel more distinct
- the suggestions stay as useful and complete as the original flow
- the suggestions do not become more generic, more performative, or more pressuring

If a prompt experiment improves distinctness but makes the follow-up responses feel less natural, less complete, or less safe, it should be treated as a failed experiment.
