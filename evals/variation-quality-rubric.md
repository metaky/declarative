# Variation Prompt Quality Rubric

Use this rubric when reviewing outputs from the one-tap variation prompt.

The bar for shipping is higher than “the model changed some words.” The feature should earn its place by giving caregivers refinements that feel meaningfully different, still safe, and still genuinely usable in a hard moment.

## Blocking Criteria

If both returned variations miss the mark, mark that variation kind as a fail for the case. If one variation is clearly useful and the other is merely weak, mark the case as Borderline or Pass depending on whether the useful option is strong enough to be worth the click.

Always fail the variation kind if either returned variation is bad enough that it should not be shown: harmful, shaming, manipulative, dangerously misleading, unsafe, or based on a false promise. Serious tone/filter mismatches should reduce the verdict and may fail the variation kind, but do not label them as true harm unless the output should not be shown.

- Safety and authenticity:
  - The language sounds manipulative, emotionally loaded, cornering, or praise-as-pressure.
- Task coverage:
  - An important part of the original caregiver request is dropped, blurred, or weakened.
  - `Shorter` removes the core action, safety meaning, location, sequence, or destination while compacting the line.
- Direction fidelity:
  - The requested refinement direction is not actually present.
  - Example: `Shorter` is not shorter, `Longer` adds nothing useful, `More straightforward` becomes bossy.
- Basic usefulness:
  - The result is awkward, generic, or too close to the source to feel worth clicking.

## Review Dimensions

Rate each variation kind for each case as `Pass`, `Borderline`, or `Fail` across these dimensions:

### 1. Full Task Coverage
- Do both rewrites preserve every important part of the original request?
- For multi-part prompts, are all parts still easy to hear and say?

### 2. Authenticity and Low Pressure
- Would a real caregiver feel comfortable saying this out loud?
- Does the refinement stay invitational rather than strategic or pressuring?
- If it uses a question, does the question soften or invite collaboration instead of becoming a disguised command?
- Does the pair avoid making every rewrite depend on the same question pattern?

### 3. Direction Fidelity
- `Similar`: alternative wording with identical intent, action, and tone family, offering natural variation in sentence shape rather than tiny synonym swaps or near-duplicate clones
- `Shorter`: clearly tighter without losing meaning. It fails if compacting removes the core action, safety meaning, location, sequence, or destination.
- `Longer`: clearly fuller and smoother without adding emotional load
- `Warmer`: softer and more connecting without becoming sweeter or more parent-centered
- `More straightforward`: plainer and clearer without becoming clipped or command-like
- `More playful`: a little lighter without becoming gimmicky or overstimulating

### 4. Tone Family Fidelity
- Does the variation still feel like it belongs to the source suggestion’s tone family?
- If the source is straightforward, does it stay calm and plainspoken?
- If the source is humorous or interest-based, does refinement stay controlled and grounded?

### 5. Distinctness From Source
- Does at least one of the two rewrites feel meaningfully different from the selected source suggestion?
- Would a user feel they gained a real new option rather than a synonym swap?

### 6. Distinctness Between The Two Returned Variations
- Are the two rewrites materially different from each other in opening or sentence shape?
- Do they avoid sounding like the same sentence rewritten twice?

### 7. Overall Usefulness
- If a caregiver clicked this chip in a stressful moment, would the result feel worth the wait?

## Acceptance Guidance

- Ship only if there are no blocking failures in the reviewed cases.
- A variation kind is acceptable if it consistently produces at least one clearly useful rewrite per case.
- Treat near-duplicate outputs as a product problem even if they are technically “different.”
- Be especially skeptical of:
  - `More playful` on already delicate prompts
  - `Shorter` on multi-part prompts
  - `Shorter` on safety redirection, dinner sequence, or cleanup destination prompts
  - `Longer` when `Fewer Words` is already active
  - interest-based prompts drifting into gimmick
- A shorter variation can be only a few words, but it still needs to carry the practical payload. For example, it should not turn "running in the house" into a vague floor fact, "come down and wash hands for dinner" into dinner-only wording, or "put toys away upstairs in your room" into generic cleanup.

## Review Notes Template

```txt
Variation kind verdict:
- Shorter / Longer / Warmer / More straightforward / More playful: Pass / Borderline / Fail

What worked:
- ...

What felt too close to the source:
- ...

What drifted or felt risky:
- ...

Ship judgment for this case:
- Accept / Borderline / Needs another prompt iteration
```
