# Gemini Optimization TODO

This file tracks the immediate implementation steps to reduce Gemini cost while preserving output quality and user experience. Tasks are atomic and each includes success criteria that can be verified by code inspection, logs, tests, or application behavior. As items are completed, update their checkboxes from `[ ]` to `[x]` so progress stays visible.

## 1. Disable dynamic thinking on the current model
- [x] Add `thinkingConfig: { thinkingBudget: 0 }` to the existing `gemini-2.5-flash` request path.
  - Success Criteria:
    - The Gemini request config explicitly disables thinking on the current `gemini-2.5-flash` call.
    - The endpoint still returns the same JSON array shape expected by the frontend.
    - Existing timeout and error handling behavior remains intact.

- [ ] Confirm the translator still behaves correctly with thinking disabled before any further optimization changes.
  - Success Criteria:
    - Local translation requests still return valid JSON that parses successfully.
    - At least one manual prompt per tone returns usable results with no obvious behavior regressions.
    - No frontend changes are required to consume the response.

- [ ] Capture before-and-after latency and token-usage evidence once usage logging is available.
  - Success Criteria:
    - Baseline and post-change latency observations are recorded from real requests.
    - `thoughtsTokenCount` is zero or absent in a way that is consistent with thinking being disabled.
    - Translation latency is not worse than baseline and ideally improves.

## 2. Add request-level usage metadata logging
- [x] Log Gemini `usageMetadata` for every successful translation request when the SDK provides it.
  - Success Criteria:
    - Successful translation requests emit structured logs containing usage metadata when available.
    - Logged fields include `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, and `totalTokenCount`.
    - Cache-related fields such as `cachedContentTokenCount` or cache-hit details are logged when present.

- [x] Keep the logging safe and operationally useful for Cloud Run inspection.
  - Success Criteria:
    - Logs are structured consistently enough to filter and compare in Cloud Run.
    - Logs do not expose more user-sensitive prompt content than is necessary for debugging and cost analysis.
    - Missing metadata does not throw or break successful requests.

- [x] Verify that usage logging does not change the API contract or user-facing behavior.
  - Success Criteria:
    - The frontend still receives the same response body shape as before.
    - Successful requests continue to render translations normally.
    - Cloud Run logs provide enough information to compare cost before and after later steps.

## 3. Build the quality evaluation workflow with heavy manual testing
- [x] Create a saved evaluation set of real-world prompts that represents how caregivers actually use the tool.
  - Success Criteria:
    - The evaluation set includes short prompts, medium prompts, and multi-part prompts.
    - The set includes examples for every tone: Default, Straightforward, Humorous, Equalizing, and Interest Based.
    - The set includes prompts that use the `Fewer Words` toggle.
    - The set includes prompts that exercise `Get more ideas` follow-up behavior.

- [x] Define a manual review rubric that makes output-quality decisions explicit and repeatable.
  - Success Criteria:
    - The rubric scores or clearly evaluates authenticity, low-pressure tone, task coverage, tone fidelity, clarity, non-manipulativeness, and overall usefulness.
    - The rubric makes multi-part task coverage a first-class criterion, not an optional note.
    - The rubric states that safety, authenticity, and full task coverage are blocking requirements.

- [x] Run side-by-side manual comparisons of current `gemini-2.5-flash` output versus `gemini-2.5-flash-lite`.
  - Success Criteria:
    - Each prompt in the evaluation set is reviewed side by side for both models.
    - Manual review is performed for every tone, not just a default-tone sample.
    - `Fewer Words` outputs are reviewed separately because compactness can hide regressions.
    - `Get more ideas` follow-ups are reviewed to verify distinctness and deduplication quality.

- [x] Record pass/fail notes and end the evaluation with a clear model recommendation.
  - Success Criteria:
    - Each reviewed prompt has written pass/fail notes against the rubric.
    - Any downgrade in safety, authenticity, or coverage is treated as a blocker even if cost improves.
    - Step 3 ends with a documented recommendation to either keep Flash, switch fully to Flash-Lite, or adopt a hybrid routing approach.
    - The recommendation explicitly prioritizes preserving quality over maximizing savings.

- [x] Require ample manual testing before approving any model-routing change.
  - Success Criteria:
    - The evaluation sample is meaningfully broad, not a tiny smoke test.
    - At least several prompts per tone are reviewed manually.
    - Multi-round follow-up behavior is checked for representative prompts.
    - No model switch is approved until the manual review says quality is preserved.

## 4. Evaluate prompt caching
- [x] Measure real prompt token counts before choosing a caching strategy.
  - Success Criteria:
    - Real production-like requests are inspected using logged token metadata.
    - The team can determine whether the shared prompt prefix is large enough often enough to matter.
    - The decision is based on measured token profiles rather than assumptions.

- [x] Compare implicit caching behavior against explicit caching feasibility and complexity.
  - Success Criteria:
    - The evaluation documents whether requests consistently cross the token threshold for meaningful caching benefit.
    - Available cache-hit-related metadata is inspected when present.
    - The operational cost and implementation complexity of explicit caching are compared with current implicit caching behavior.

- [x] Only move forward with explicit caching if the numbers justify it.
  - Success Criteria:
    - A clear go/no-go decision is documented before implementation begins.
    - Any chosen caching TTL, lifecycle assumptions, and invalidation expectations are written down.
    - Structured JSON output correctness is preserved in any caching experiment.

## 5. Trim prompt verbosity safely
- [x] Audit the prompt for duplicated or overly repetitive instruction text.
  - Success Criteria:
    - Repeated guidance between `systemInstruction` and tone-specific instructions is identified explicitly.
    - The audit distinguishes necessary behavioral guidance from redundant phrasing.
    - Candidate trims are documented before they are implemented.

- [x] Remove redundancy while preserving behavioral intent and safety.
  - Success Criteria:
    - Prompt wording is shortened without changing the required response format.
    - Safety, authenticity, and anti-manipulation guidance remain intact after trimming.
    - Tone-specific behavior remains clearly defined after edits.

- [x] Re-measure prompt token usage and rerun the quality evaluation after trimming.
  - Success Criteria:
    - Prompt token counts drop meaningfully relative to the current baseline.
    - Outputs continue to satisfy the rubric from Step 3.
    - No tone loses its defining behavior.
    - Multi-part prompts still preserve all required parts of the user request.

Step 5 decision:
- Keep the prompt trim overall because it reduced average prompt tokens meaningfully without causing a broad quality collapse.
- Treat `Get more ideas` follow-ups as the main remaining quality risk after trimming.
- Keep watching Straightforward, Interest Based, and multi-part follow-up cases for any softening into generic phrasing.

## 6. Review and improve the "Get more ideas" prompt
- [x] Capture and document the exact prompt shape currently sent for `Get more ideas`.
  - Success Criteria:
    - The current follow-up prompt assembly is written down in a review artifact.
    - The artifact clearly shows what comes from the shared prompt, what comes from the tone overlay, and how prior translations are injected.
    - The document highlights where the follow-up prompt likely becomes too generic or too repetitive.

- [x] Propose prompt-level improvements for `Get more ideas` before changing the implementation.
  - Success Criteria:
    - The proposed guidance explains how to preserve distinctness without increasing pressure.
    - The proposed guidance explains how to avoid generic rewordings of earlier suggestions.
    - The proposed guidance explains how to preserve multi-part completeness and tone fidelity.
    - The prompt guidance stays grounded enough that a human can review it before implementation.

- [x] Generate before-and-after `Get more ideas` test results using representative prompts.
  - Success Criteria:
    - The test set includes at least one Default follow-up case and one Interest Based follow-up case.
    - The results are saved in a reviewable artifact rather than only described in chat.
    - The artifact makes it easy to compare distinctness, naturalness, and completeness side by side.

- [x] Review the `Get more ideas` prompt results together before approving implementation changes.
  - Success Criteria:
    - The review explicitly calls out where the follow-up prompt still collapses into generic language.
    - Any proposed prompt change is judged against the same quality bar used for the main translation flow.
    - No `Get more ideas` prompt change is treated as accepted until the human review says quality improved.

## 7. Rework "Get more ideas"
- [x] Redesign follow-up generation so it does not resend every prior translation verbatim unless necessary.
  - Success Criteria:
    - Follow-up requests carry only the minimum context needed to avoid repetition.
    - The deduplication strategy is preserved or improved.
    - The frontend flow still behaves naturally for users asking for more ideas.

 - [x] Preserve acceptable output quality for a rarely used follow-up flow without adding heavier implementation complexity.
  - Success Criteria:
    - Round 1 remains clearly useful, and round 2 is usually still acceptable for human use.
    - Residual sameness in later rounds is documented and judged acceptable relative to the low feature usage.
    - No heavier retry, reroll, or stateful follow-up orchestration is required to ship the lightweight improvement.

- [x] Manually test multi-round follow-up behavior on representative prompts.
  - Success Criteria:
    - At least several prompts are tested through multiple `Get more ideas` rounds.
    - Multi-part prompts are included in multi-round testing.
    - Distinctness, usefulness, and tone fidelity hold up across repeated follow-ups.

Step 7 status:
- The follow-up prompt now summarizes already-covered angles instead of pasting prior suggestions back verbatim.
- Manual multi-round review shows that round 1 is generally good and round 2 is usually acceptable, while round 3 can become same-y.
- Because users rarely request more than one extra round on the same prompt, the lightweight server-side improvement is accepted as good enough.
- No further `Get more ideas` optimization work is planned unless usage patterns or user complaints suggest this feature matters more than current evidence indicates.

## Validation Requirements Across All Steps
- [ ] Require code-level verification after each implementation step.
  - Success Criteria:
    - Gemini request configuration changes are verified directly in code.
    - Logging behavior is inspected directly in code where applicable.

- [ ] Require local behavior checks after each implementation step.
  - Success Criteria:
    - The translator still returns valid JSON responses.
    - The app still renders and behaves correctly in the normal translation flow.

- [ ] Require Cloud Run verification after each implementation step that affects live request behavior.
  - Success Criteria:
    - Cloud Run logs are inspected for usage metadata, latency, and errors.
    - Live logging is sufficient to compare before-and-after behavior.

- [ ] Require regression checks after each prompt, model, or follow-up-flow change.
  - Success Criteria:
    - Multi-part prompts are re-tested after each relevant change.
    - Tone fidelity is re-tested after each relevant change.
    - `Fewer Words` and `Get more ideas` are re-tested after each relevant change.
    - Manual QA remains part of the acceptance criteria, especially for Step 3.
