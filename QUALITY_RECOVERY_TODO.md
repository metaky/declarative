# Translator Quality Recovery TODO

Use this checklist as the source of truth for the recovery work. Do not deploy prompt changes until the manual review gates are checked by Kyle.

## 1. Stabilize Baseline And Current Work

- [x] Preserve the current uncommitted prompt attempt as a comparison point
  - Validation: `git status --short` shows the latest prompt/eval work remains in the working tree.

- [x] Record current automated eval as untrusted signal, not product truth
  - Current report: `evals/results/latest-translation-output-evaluation.md`
  - Current issue: latest automated eval is useful for examples, but not calibrated to the new "1-2 excellent options can pass" standard.

- [x] Create this recovery TODO
  - Validation: this file separates calibration, history, prompt hierarchy, model bakeoff, and production implementation.

- [x] Kyle confirms the scoring principle
  - Manual gate: Kyle confirmed that a set should not fail solely because it has weak extras when it includes at least one excellent option.
  - Clarification: reserve "harmful" for should-not-show output. Use serious mismatch for outputs that are bad enough to affect or fail the set but are not unsafe/shaming in the real-world sense.
  - Clarification: questions are allowed when they soften a demand or invite collaboration; avoid overusing them or turning them into faux choices.
  - Clarification: one excellent option should prevent an automatic fail unless the selected tone/filter mostly misses, Fewer Words materially misses, coverage is unsafe, or a should-not-show output exists.

## 2. Build Human-Calibrated Gold Set

- [x] Generate a 40-item human calibration review set
  - Command: `npm run quality:calibration-set`
  - Outputs:
    - `evals/human-calibration-set.json`
    - `evals/human-calibration-review.md`

- [x] Kyle labels the 40 review items
  - Fill these fields per item:
    - `bestOptionCount`
    - `hasExcellentOption`
    - `hasHarmfulOption`
    - `setVerdict`
    - `why`

- [x] Compare automated evaluation against Kyle labels using clarified semantics
  - Command: `npm run quality:calibration-analyze`
  - Validation: report identifies agreement rate and disagreement examples.
  - Result: automated agreement remains low at 10/31, confirming the old automated evaluator should not drive optimization decisions by itself.

## 3. Redesign Evaluation Logic

- [x] Update automated eval schema for per-option and set-level scoring
  - Required fields:
    - `optionEvaluations`
    - `bestOptionCount`
    - `excellentOptionCount`
    - `shouldNotShowOptionCount`
    - `seriousMismatchOptionCount`
    - `harmfulOptionCount` for backward compatibility only
    - `setVerdict`
    - `confidence`

- [x] Update reports to focus on best usable options
  - Validation: report includes best-option metrics, should-not-show counts, serious mismatch counts, and blocking counts.

- [x] Add repeated-run variance support
  - Command: `node scripts/run-translation-output-eval.mjs --repeats=2`
  - Validation: report includes repeated scoring variance when repeats are used.

- [ ] Kyle reviews evaluator disagreements
  - Manual gate: review 8-10 cases where automated scoring disagrees with Kyle.
  - Current packet: `evals/results/evaluator-calibration-packet.md`
  - Current re-score report: `evals/results/latest-calibrated-evaluator-check.md`
  - Finding: prompt-only evaluator tuning improved raw agreement from 32% to 40%, but deterministic postprocessing gates improved agreement to 63%.
  - Recommendation: keep moving with a hybrid evaluator model: Gemini option scoring plus deterministic gates for Fewer Words length, should-not-show outputs, obvious set-count contradictions, and severe tone/filter misses.

## 4. Test Historical Quality Drop

- [x] Identify historical prompt candidates
  - Current working tree: latest prompt attempt
  - Current main: `ce64281`
  - Suspected stronger conversational prompt: `91aba8e`

- [x] Add prompt history comparison tooling
  - Command: `npm run quality:prompt-history`
  - Validation: report can compare prompt size and generated prompt text across refs.

- [x] Run historical output comparison after Kyle labels the gold set
  - Validation: compare current production, latest prompt attempt, and `91aba8e` using the calibrated scoring rule.
  - Dependency: use postprocessed calibrated scoring, not raw Gemini verdicts, because raw calibrated agreement remains too low.
  - Full scored 40-case result:
    - working tree latest attempt: Pass 19, Borderline 10, Fail 11; prompt tokens 27,098; output tokens 4,706.
    - current main candidate: Pass 16, Borderline 9, Fail 15; prompt tokens 33,043; output tokens 5,544.
    - older conversational candidate `91aba8e`: Pass 16, Borderline 2, Fail 22; prompt tokens 40,753; output tokens 5,413.
  - Read: current working-tree prompt outperforms both historical candidates on the full calibrated set while also using fewer prompt tokens than main/current production and much fewer than the older conversational prompt.
  - Remaining issue: working-tree failures cluster around Fewer Words, especially Equalizing, Humorous, Interest Based, and Interest Based missing-interest cases.

- [ ] Kyle reviews side-by-side historical examples
  - Manual gate: decide which older wording should be restored.

## 5. Rebuild Prompt Hierarchy

- [x] Rework master prompt around real caregiver speech first
  - Validation: `services/translationPrompt.js` places sayable caregiver language above environment-first framing and brevity.

- [x] Demote rigid environment-first phrasing
  - Validation: prompt warns that "floor is for walking" style captions can sound like rules.

- [x] Make tone prompts strategy-specific
  - Validation: Default, Straightforward, Humorous, Equalizing, and Interest Based describe distinct strategies.
  - Kyle clarification: for Interest Based, every returned option must meaningfully integrate the interest or a recognizable element from it. One or two interest-based options are not enough for this tone because the user selected that filter intentionally.
  - Update: Interest Based now requires meaningful interest logic in every option, while still blocking false labels, arbitrary name-drops, invented props/places, and renamed task objects.

- [x] Add compact hard-case guidance
  - Covered cases: safety redirection, dinner sequence, cleanup destination, no-interest fallback, anti-caption behavior.
  - Update: Fewer Words now has stricter hard-filter guidance plus compact examples for safety, meal/handwashing, cleanup destination, Equalizing, Humorous, and Interest Based.
  - Update: Interest Based hard-case guidance now includes factual patterns for safety, dinner/handwashing, and cleanup so the model can include the interest without turning toys, hands, rooms, or dinner into interest-themed objects.

- [x] Kyle reviews prompt layers before live optimization eval
  - Manual gate: review generated prompt examples before treating results as candidate production behavior.
  - Current review packet: `evals/results/latest-quality-review-packet.md`
  - Kyle decision: prompt layers match the desired product voice.

## 6. Add One-Call Quality Improvements

- [x] Keep one Gemini request per user-facing request
  - Validation: `server.js` still calls `ai.models.generateContent` once per `/api/translate` request.

- [x] Add private candidate drafting and selection criteria inside the prompt
  - Validation: prompt asks model to draft more candidates privately and return only the best 3-4.

- [x] Add zero-token Interest Based missing-interest guard
  - Validation: UI blocks translate, more-ideas, and variations when Interest Based has no entered interest.
  - Validation: server rejects direct Interest Based API requests without an interest instead of spending model tokens on weak fallback output.

- [x] Add Interest Based meaningful-integration and grounding guardrails
  - Command: `npm run quality:interest-guardrails`
  - Validation: fails examples where an option omits the interest/recognizable element, bare-name-drops the interest, renames generic toys as interest toys, invents interest storage/places, or uses the interest as a false label for hands.
  - Validation: allows grounded comparisons such as Squirtle/sink/water logic, Poke-stop transition logic, interest-style routes, paths, teams, and careful movement when the real-world facts stay unchanged.

- [x] Run quality eval after Kyle prompt review
  - Command: `npm run quality:eval -- --repeats=2`
  - Validation: best-option rate improves without adding a second request.
  - Post-clarification evidence: full Flash baseline bakeoff after stricter Fewer Words guidance improved from Pass 21, Borderline 4, Fail 15 to Pass 28, Borderline 10, Fail 2 on the 40-case set.
  - Cost evidence: prompt tokens increased from 27,098 to 29,514, but output tokens dropped from 4,540 to 3,912; estimated generation cost decreased slightly from $0.019481 to $0.018635 for the 40-case run.
  - Variance check: a same-code rerun landed at Pass 28, Borderline 9, Fail 3 with prompt tokens 29,514, output tokens 4,090, and estimated generation cost $0.019077. This is still a large improvement over the old full baseline and remains slightly below the old estimated cost.
  - Rejected experiment: a stricter Interest Based ratio instruction increased gimmickry and worsened the result to Pass 28, Borderline 9, Fail 3 with lower usable/excellent averages, so that prompt edit was reverted.
  - Remaining issue: non-pass rows now cluster around Interest Based consistency and weaker tone fidelity, not broad Fewer Words length failure.
  - Kyle decision: no-interest Interest Based cases should be removed from quality aggregates now that production blocks that request path.
  - Tooling update: model bakeoff summaries and review packets now exclude guardrail-only no-interest Interest Based rows from aggregate quality counts while preserving them for traceability.
  - Updated aggregate read after exclusion: Pass 28, Borderline 9, Fail 2; prompt tokens 28,859; output tokens 3,992; estimated generation cost $0.018636.
  - Focused strict Interest Based run after Kyle integration clarification: 6 targeted Pokemon cases landed at Pass 6, Borderline 0, Fail 0; prompt tokens 7,927; output tokens 464; estimated generation cost $0.003538.
  - Read: the latest examples use more integrated Pokemon logic, including Squirtle/sink/water, Poke-stop transition stops, Trainer routes, Pikachu speed, and Pokemon-style cleanup routes.
  - Remaining review point: Kyle should confirm whether the latest examples feel truly integrated enough, because automated scoring can still overrate options that technically map the interest but feel a little stiff.
  - Full 40-case variance run A after latest Interest Based changes: Pass 32, Borderline 4, Fail 3; prompt tokens 37,024; output tokens 3,565; estimated generation cost $0.020017.
  - Full 40-case variance run B after latest Interest Based changes: Pass 35, Borderline 4, Fail 0; prompt tokens 37,024; output tokens 3,625; estimated generation cost $0.020167.
  - Current read: no should-not-show outputs were found. The remaining consistent non-pass cluster is compact Humorous/Equalizing tone strength, not task coverage or safety.
  - Focused Equalizing + Fewer Words cleanup test after Kyle feedback: `current-28-toys-upstairs-equalizing-fewer` moved from Borderline to Pass in focused testing with outputs like "Wait, do these toys go upstairs?" and "I'm stuck on the toy route. Room next?"
  - Broader Equalizing + Fewer Words mini-run across running, dinner, and cleanup landed at Pass 3, Borderline 0, Fail 0; prompt tokens 3,151; output tokens 226; estimated generation cost $0.001510.
  - Kyle decision: approve the Equalizing + Fewer Words direction. Compact questions are the right move here because the tone and Fewer Words filter leave little room for fuller status-leveling language.
  - Guardrail: do not make questions the universal declarative strategy. Questions should remain one option in the mix, except possibly for constrained Equalizing + Fewer Words moments where questions are the cleanest way to make the child the checker/expert/leader.
  - Final full calibrated run after Interest Based generalization and Pokemon cleanup guardrails: Pass 36, Borderline 3, Fail 0 across 39 aggregate cases; 1 no-interest guardrail case excluded; should-not-show outputs 0; prompt tokens 39,997; output tokens 3,561; estimated generation cost $0.020900.
  - Final read: Equalizing + Fewer Words and Interest Based hard cases pass in the latest full run. Remaining Borderline rows are Fewer Words tone-consistency issues in Humorous running, Straightforward cleanup, and Humorous cleanup, not safety or should-not-show failures.

- [x] Kyle reviews strict Interest Based examples
  - Manual gate: confirm whether the latest focused Pokemon examples satisfy the new rule and feel good enough to fold into the full eval.
  - Current focused report: `evals/results/latest-model-bakeoff.md`
  - Kyle decision: Pokemon direction is looking better, but generalization needed testing.

- [x] Add reusable multi-interest generalization check
  - Command: `npm run quality:interest-generalization`
  - Validation: generated Minecraft, trains, and Disney Interest Based outputs across the 3 core inputs.
  - Output: `evals/results/latest-interest-generalization.md`
  - Kyle decision: examples are generally good to go.
  - Update: added an automatic cross-interest leak detector so non-Pokemon interests fail the check if they produce Pokemon/Trainer/Poke-stop/Gym/Squirtle/Pikachu language.
  - Latest validation: refreshed Minecraft, trains, and Disney outputs passed with no cross-interest leaks after generic Interest Based guidance was separated from Pokemon-specific guidance.

## 7. Run Model And Thinking Budget Bakeoff

- [x] Refresh model availability and pricing from official Gemini docs
  - Sources:
    - `https://ai.google.dev/gemini-api/docs/models`
    - `https://ai.google.dev/gemini-api/docs/pricing`
  - Latest check: 2026-06-02.
  - Note: official docs still list the tested 2.5 Flash, 2.5 Pro, 3 Flash Preview, and 2.5 Flash-Lite candidates/prices, and now also show newer Gemini 3.5/3.1 options that should be considered in a follow-up bakeoff before production selection.

- [x] Add model bakeoff tooling
  - Command: `npm run quality:model-bakeoff`
  - Candidates: `gemini-2.5-flash`, `gemini-2.5-flash` with small thinking budget, `gemini-2.5-pro`, `gemini-3-flash-preview`, `gemini-2.5-flash-lite`.

- [x] Run model bakeoff after Kyle calibration labels exist
  - Validation: report compares quality, latency, prompt/output token use, and estimated token cost.
  - Full 40-case Flash baseline result:
    - `gemini-2.5-flash` baseline: Pass 21, Borderline 4, Fail 15; average latency 1,179 ms; prompt tokens 27,098; output tokens 4,540; estimated generation cost $0.019481.
    - Failure pattern: mostly `Fewer Words` length misses and `Interest Based` integration misses; no should-not-show options.
  - Current cross-model scored 8-case result:
    - `gemini-2.5-flash` baseline: Pass 6, Borderline 2, Fail 0; estimated generation cost $0.003646.
    - `gemini-2.5-flash` thinking 256: Pass 6, Borderline 1, Fail 1; estimated generation cost $0.003956.
    - `gemini-2.5-pro`: Pass 4, Borderline 1, Fail 3; estimated generation cost $0.017763.
    - `gemini-3-flash-preview`: Pass 4, Borderline 1, Fail 3; estimated generation cost $0.005167.
    - `gemini-2.5-flash-lite`: Pass 5, Borderline 0, Fail 3; estimated generation cost $0.000969.
  - Read: Flash baseline remains the strongest default candidate on current evidence; no higher-cost model has earned a default switch.
  - Cost-control update: model bakeoff supports `--candidates=` so full 40-case runs can be targeted instead of running every model blindly.
  - Updated full 40-case Flash baseline after Fewer Words prompt tightening:
    - `gemini-2.5-flash` baseline: Pass 28, Borderline 10, Fail 2; average latency 1,116 ms; prompt tokens 29,514; output tokens 3,912; estimated generation cost $0.018635.
    - Same-code rerun: Pass 28, Borderline 9, Fail 3; average latency 1,131 ms; prompt tokens 29,514; output tokens 4,090; estimated generation cost $0.019077.
    - Read: this is a meaningful quality lift with no second request and no net cost increase in these runs, despite higher prompt tokens.
    - Caveat: one failure in each run is the now-guarded no-interest Interest Based calibration case; production now rejects that request before a model call.
  - Focused 10-case hard-case model comparison:
    - `gemini-3.5-flash`: Pass 5, Borderline 4, Fail 1; average latency 1,507 ms; estimated generation cost $0.011340.
    - `gemini-3.1-flash-lite`: Pass 3, Borderline 6, Fail 1; average latency 1,115 ms; estimated generation cost $0.003985.
    - `gemini-2.5-flash` baseline: Pass 1, Borderline 5, Fail 4; average latency 1,179 ms; estimated generation cost $0.004945.
    - `gemini-2.5-flash` thinking 256: Pass 2, Borderline 5, Fail 3; average latency 2,238 ms; estimated generation cost $0.005048.
    - `gemini-2.5-pro`: Pass 3, Borderline 7, Fail 0; average latency 23,357 ms; estimated generation cost $0.021311.
    - `gemini-3-flash-preview`: Pass 3, Borderline 4, Fail 3; average latency 1,463 ms; estimated generation cost $0.006462.
    - `gemini-2.5-flash-lite`: Pass 3, Borderline 2, Fail 5; average latency 907 ms; estimated generation cost $0.001182.
    - Read: `gemini-3.5-flash` is the strongest hard-case candidate on quality/latency balance, but it costs materially more than `gemini-2.5-flash`; do not route or switch until Kyle reviews examples.
  - Tooling update: `quality:model-bakeoff` now supports `--case-ids=` and includes stable Gemini 3.5/3.1 candidates from the official docs.

- [x] Kyle reviews model comparison examples
  - Manual gate: choose whether to keep Flash, route hard cases, or test a preview model further.
  - Current review packet: `evals/results/latest-quality-review-packet.md`
  - Kyle decision: keep `gemini-2.5-flash` as the default model. Do not implement hard-case routing to `gemini-3.5-flash` in this phase.

- [x] Build Kyle-facing review packet
  - Command: `npm run quality:review-packet`
  - Validation: packet separates full 40-case evidence from focused hard-case model evidence.
  - Output: `evals/results/latest-quality-review-packet.md`

## 8. Implement Winning Production Path

- [ ] Select winning prompt/model path after calibrated comparison
  - Do not choose based on one uncalibrated automated run.

- [ ] Verify production readiness
  - Commands:
    - `npm run lint`
    - `npm run build`
    - calibrated eval command chosen above

- [ ] Kyle reviews final side-by-side outputs
  - Manual gate before deployment.

- [ ] Deploy only after Kyle approves
  - Command: `npm run deploy`
  - Validation: confirm Cloud Run URL and `https://declarativeapp.org` return HTTP 200.
