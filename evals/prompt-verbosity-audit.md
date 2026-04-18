# Prompt Verbosity Audit

This note documents the Step 5 prompt audit and the trimming decisions made before re-running quality comparisons.

## What Was Repetitive

The previous prompt assembly repeated several ideas in both the shared `systemInstruction` and the tone-specific prompt overlays:

- low-pressure / autonomy-supportive / non-manipulative guardrails
- environment-first / observation-first guidance
- anti-shame / anti-pressure / anti-cornering language
- reminders to preserve felt safety and connection

Those constraints are still important, but repeating them in every tone overlay made the request larger without clearly adding new tone-specific behavior.

## What We Kept

We preserved:

- the full shared `systemInstruction`
- the base prompt requirements around:
  - preserving the full meaning
  - covering all parts of the request
  - preferring environment-first framing
  - avoiding repeated caregiver-first openings
- the unique behavioral cues for each tone

## What We Trimmed

We shortened the tone overlays so they now focus on what is unique to each tone:

- Default:
  - reduced to a short tone statement
- Straightforward:
  - kept calm/plainspoken guidance, concise-vs-fuller mix, and anti-bossy constraints
  - removed repeated universal safety boilerplate already enforced elsewhere
- Interest Based:
  - kept the requirement that the interest stay light and not become the main point
  - removed repeated universal safety boilerplate
- Equalizing:
  - kept the dignity / not-mocking / not-helpless boundaries
  - removed repeated universal safety boilerplate
- Humorous:
  - kept anti-sarcasm / anti-ridicule / anti-overstimulation guidance
  - removed repeated universal safety boilerplate

## Why This Is a Conservative Trim

This trim does **not** remove the core safety and authenticity constraints from the request overall.

Instead, it:

- leaves the strongest universal constraints in the shared system instruction
- leaves the unique tone constraints in the tone overlays
- removes duplicated wording that was likely inflating prompt size more than improving behavior

## What Must Be Re-Checked

After this trim, we must re-check:

- multi-part completeness
- `Fewer Words` behavior
- humorous tone drift
- equalizing tone dignity and safety
- interest-based tone over-gimmick risk
- `Get more ideas` distinctness

If any of those regress, we should revert or partially restore the removed wording rather than keep a cheaper but weaker prompt.
