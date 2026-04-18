# Prompt Trim Results

This note records the first Step 5 re-measurement after trimming repeated prompt wording.

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

## Review Files

- Baseline comparison:
  - [gemini-model-comparison-2026-04-18T11-51-55-006Z.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/gemini-model-comparison-2026-04-18T11-51-55-006Z.md)
- Post-trim comparison:
  - [gemini-model-comparison-2026-04-18T12-02-46-754Z.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/gemini-model-comparison-2026-04-18T12-02-46-754Z.md)
- Latest comparison shortcut:
  - [latest-gemini-model-comparison.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/results/latest-gemini-model-comparison.md)
- Rubric:
  - [gemini-quality-rubric.md](/Users/kyle.wegner/Dev%20Projects/declarative/evals/gemini-quality-rubric.md)

## What Needs Human Review

The token reduction is clear, but we should keep the trim only if the outputs still meet the same quality bar.

Pay special attention to:

- multi-part completeness
- whether shorter prompts became too generic
- whether Straightforward lost useful specificity
- whether Interest Based became flatter or less grounded
- whether humorous outputs became too weird or too generic
- whether `Get more ideas` stayed distinct and useful

If the outputs feel less authentic, less complete, or less naturally helpful, revert or partially restore the removed wording rather than keep the cheaper prompt.
