# Prompt Trim Review

This is the surfaced review file for the Step 5 prompt-trimming pass.

It exists to make the trimmed-prompt results easier to find alongside the other comparison reports in `evals/results/`.

## What Changed

The prompt assembly was trimmed to remove repeated wording that appeared in both:

- the shared `systemInstruction`
- the tone-specific overlays

The goal was to lower prompt-token usage without weakening the product's safety, authenticity, completeness, or tone fidelity.

## Token Impact

Measured on the same 12-case evaluation set using `gemini-2.5-flash`:

- Before trim:
  - average prompt tokens: **926**
  - min prompt tokens: **854**
  - max prompt tokens: **1013**

- After trim:
  - average prompt tokens: **820**
  - min prompt tokens: **758**
  - max prompt tokens: **879**

- Average reduction:
  - **106 prompt tokens per request**

## Files To Review

- Before trim:
  - [gemini-model-comparison-2026-04-18T11-51-55-006Z.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/gemini-model-comparison-2026-04-18T11-51-55-006Z.md)
- After trim:
  - [gemini-model-comparison-2026-04-18T12-02-46-754Z.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/gemini-model-comparison-2026-04-18T12-02-46-754Z.md)
- Latest shortcut to the post-trim run:
  - [latest-gemini-model-comparison.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/latest-gemini-model-comparison.md)
- Review rubric:
  - [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md)
- Trim rationale:
  - [prompt-verbosity-audit.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/prompt-verbosity-audit.md)

## Recommended Review Order

1. Open the pre-trim report.
2. Open the post-trim report.
3. Compare the same prompts side by side using the rubric.
4. Focus first on:
   - Straightforward
   - Interest Based
   - Humorous
   - multi-part prompts
   - `Get more ideas`

## Decision Rule

Keep the trim only if the post-trim outputs remain:

- authentic
- low-pressure
- complete for multi-part requests
- faithful to the selected tone
- useful enough that a real caregiver would still want to say them out loud

If the trimmed version becomes cheaper but noticeably more generic, less complete, or less safe, revert or partially restore the removed wording.
