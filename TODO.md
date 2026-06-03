# Translation Output Quality Improvement TODO

Update this checklist continuously while implementing. Change each completed item from `[ ]` to `[x]` immediately after finishing that individual task.

Use the current evaluation report as the baseline:
- Markdown report: `evals/results/latest-translation-output-evaluation.md`
- Raw results: `evals/results/latest-translation-output-evaluation.json`
- Repeatable runner: `scripts/run-translation-output-eval.mjs`

Primary goal: improve translation and variation output quality across safety redirection, tone fidelity, `Fewer Words`, and one-tap variations without adding a second model pass or noticeably slowing the core translator flow.

## Current Baseline To Beat

- [x] Confirm the latest baseline report exists at `evals/results/latest-translation-output-evaluation.md`
  - Validation: run `test -f evals/results/latest-translation-output-evaluation.md && echo ok`
  - Expected: `ok`

- [x] Record the starting baseline before making prompt or UI changes
  - Current translation average: `2.83/5`
  - Current translation verdicts: `16 Pass`, `1 Borderline`, `13 Fail`
  - Current variation average: `2.88/5`
  - Current variation verdicts: `45 Pass`, `24 Borderline`, `51 Fail`
  - Current weakest input: `Stop running in the house`, `2.00/5`, `8 Fail` out of `10`
  - Current strongest input: `Please come down and wash your hands. It's dinner time.`, `3.50/5`, `8 Pass` out of `10`
  - Validation: check these values against `evals/results/latest-translation-output-evaluation.md`

## Implementation Guardrails

- [x] Preserve the single Gemini request flow for translation and variation
  - Modify only prompt construction, request metadata, UI guardrails, mock responses, and eval artifacts unless a clear structural blocker appears
  - Validation: inspect `server.js` after implementation and confirm `/api/translate` still calls `ai.models.generateContent` once per request mode

- [x] Keep task coverage higher priority than brevity
  - `Fewer Words` may shorten output, but it must not drop action, location, sequence, or safety meaning
  - Validation: every eval case for dinner and cleanup must still mention all key parts of the original request in at least 3 of 4 outputs

- [x] Keep tone output natural enough to say out loud
  - Avoid prompt wording that forces repeated formulaic labels such as `expert`, `checker`, or `route planner` in every answer
  - Validation: manual review of Equalizing outputs must confirm status-leveling is present without making every output sound like the same template

## Phase 1: Stabilize The Evaluation Harness

- [x] Add the three user-requested inputs to the durable translation prompt set
  - Modify: `evals/gemini-translation-prompt-set.json`
  - Add cases for:
    - `Stop running in the house`
    - `Please come down and wash your hands. It's dinner time.`
    - `Pick up your toys and put them away upstairs in your room`
  - Include every tone: `Default`, `Straightforward`, `Humorous`, `Equalizing`, `Interest Based`
  - Include both `useFewerWords: false` and `useFewerWords: true`
  - Use `Pokemon` only as a test fixture for `Interest Based`; label it as a fixture, not a product recommendation
  - Validation: run `node -e "const data=require('./evals/gemini-translation-prompt-set.json'); console.log(data.length)"`
  - Expected: output increases by the added cases, and JSON parses without error

- [x] Add focused variation eval cases based on the same three inputs
  - Modify: `evals/variation-prompt-set.json`
  - Cover these variation kinds: `shorter`, `warmer`, `more_straightforward`, `more_playful`
  - Include at least one source translation for each weak area:
    - Safety redirection
    - Multi-step dinner transition
    - Multi-step cleanup with destination
    - Equalizing route/order framing
    - Interest Based with a real interest fixture
  - Validation: run `node scripts/check-variation-prompts.mjs`
  - Expected: script completes and writes `evals/results/latest-variation-prompt-review.md`

- [x] Update rubric language so future scoring catches this evaluation’s failure modes
  - Modify: `evals/gemini-quality-rubric.md`
  - Add safety-redirection criteria:
    - Output must preserve the safety concern
    - Output must offer a clear lower-pressure alternative, such as walking indoors or running outside
    - Output should not collapse into vague environmental facts
  - Add cleanup destination criteria:
    - Output must preserve both cleanup and where the items go
  - Validation: review the rubric and confirm the words `safety`, `alternative`, and `destination` appear in relevant sections

- [x] Update variation rubric for `Shorter`
  - Modify: `evals/variation-quality-rubric.md`
  - Add a blocking criterion: `Shorter` fails if it removes the core action, safety meaning, location, sequence, or destination
  - Validation: review the rubric and confirm `Shorter` explicitly says compacting is not allowed to weaken meaning

## Phase 2: Fix Safety Redirection First

- [x] Add a safety-redirection instruction to the shared translation prompt
  - Modify: `services/translationPrompt.js`
  - Target: `systemInstruction` and/or `buildTranslationPrompt`
  - Behavior to add:
    - When the original request is about unsafe movement, unsafe speed, physical risk, or stopping an unsafe behavior, preserve the safety meaning
    - Prefer concrete, natural declarative redirection
    - Include a clear safer alternative when natural
    - Avoid vague facts like `movement feels fast` unless the safer alternative is also clear
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: `Stop running in the house` should improve from `2.00/5` to at least `3.00/5`

- [x] Add safety-redirection examples to local mock translations
  - Modify: `server.js`
  - Target: `buildMockTranslations`
  - Add mock behavior so local dev does not hide the intended safety pattern
  - Example target shapes:
    - `The house is a walking-speed space.`
    - `Running has more room outside.`
    - `Fast feet have a better spot outside.`
  - Validation: run local API in mock mode and call the unsafe movement prompt
  - Command: `DEV_USE_MOCK_TRANSLATIONS=true DEV_BYPASS_CHALLENGE=true PORT=3002 node server.js`
  - In another terminal: `curl -s -X POST http://localhost:3002/api/translate -H 'Content-Type: application/json' -d '{"text":"Stop running in the house","tone":"Straightforward","useFewerWords":true}'`
  - Expected: mock response includes indoor walking or outdoor running framing

- [x] Manually review safety outputs for naturalness
  - Read: `evals/results/latest-translation-output-evaluation.md`
  - Confirm outputs do not sound shaming, didactic, or passive-aggressive
  - Confirm outputs are still usable in a fast safety moment
  - Validation: mark this step complete only if at least 3 of 5 tones have usable safety-redirection output for both Fewer Words settings

## Phase 3: Strengthen Tone Contrast

- [x] Rewrite tone overlays so each tone has a distinct job
  - Modify: `services/translationPrompt.js`
  - Target: `getToneInstruction`
  - Default should stay warm, grounded, and observational
  - Straightforward should become clearer and more practical without becoming command-like
  - Humorous should use lightness sparingly and anchor back to the task
  - Equalizing should use status-leveling as the frame, not decorative wording
  - Interest Based should use the interest as connection, not theme decoration
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: average `toneFidelity` should improve for Humorous, Equalizing, and Interest Based compared with the previous report

- [x] Add a tone contrast review section to the generated report
  - Modify: `scripts/run-translation-output-eval.mjs`
  - Add a summary table that compares each tone’s average `toneFidelity` and names the weakest tone
  - Validation: run `node scripts/run-translation-output-eval.mjs --rebuild-latest`
  - Expected: `evals/results/latest-translation-output-evaluation.md` includes a tone contrast summary

- [x] Manually compare one input across all tones
  - Use input: `Please come down and wash your hands. It's dinner time.`
  - Confirm each tone has a recognizable strategy while preserving all task details
  - Validation: write a short note in the implementation summary naming the best and weakest tone after changes

## Phase 4: Tighten Humorous Without Making It Gimmicky

- [x] Refine Humorous prompt guidance
  - Modify: `services/translationPrompt.js`
  - Target: `getToneInstruction('Humorous')`
  - Add constraints:
    - Use one light playful image at most
    - Do not over-personify floors, walls, toys, furniture, sinks, or rooms
    - Do not make the line longer just to be funny
    - Keep the concrete task visible
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: Humorous should improve from `2.67/5` overall, with fewer fails on safety and cleanup prompts

- [x] Update Humorous mock responses
  - Modify: `server.js`
  - Target: `toneTemplates.Humorous`
  - Replace any mock phrasing that encourages gimmicky outputs with grounded lightness
  - Validation: run mock-mode curl tests for all three inputs using `tone: "Humorous"`
  - Expected: mock outputs stay short, task-visible, and not overly theatrical

- [x] Review Humorous variation behavior
  - Read: `evals/results/latest-translation-output-evaluation.md`
  - Focus on `More playful` variation results
  - Validation: mark complete only if `More playful` adds lift without turning safety or cleanup into a joke

## Phase 5: Make Equalizing More Reliable

- [x] Add context-specific Equalizing guidance
  - Modify: `services/translationPrompt.js`
  - Target: `getToneInstruction('Equalizing')`
  - Add examples of equalizing frames by situation:
    - Safety: child as safety checker or adult unsure which speed fits the room
    - Dinner transition: child as route/order expert
    - Cleanup: child as room-reset boss, destination checker, or upstairs route planner
  - Keep the existing guard against mocking, helplessness, sarcasm, praise-pressure, or performance
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: Equalizing should improve from `2.67/5` overall, with status-leveling visible in at least 3 of 4 outputs per Equalizing run

- [x] Update Equalizing mock responses
  - Modify: `server.js`
  - Target: `toneTemplates.Equalizing`
  - Ensure mock outputs include child-as-checker/leader/order framing for multi-step requests
  - Validation: run mock-mode curl tests for all three inputs using `tone: "Equalizing"`
  - Expected: each mock output makes the child more powerful or the adult gently uncertain without sounding forced

- [x] Manually review Equalizing for sameness
  - Read: `evals/results/latest-translation-output-evaluation.md`
  - Confirm the prompt does not force every output to use the same role name
  - Validation: mark complete only if the four Equalizing outputs vary in sentence shape and status-leveling strategy

## Phase 6: Add Interest Based Guardrails

- [x] Confirm current UI behavior when Interest Based has no interest
  - Inspect: `components/Translator.tsx`
  - Determine whether the user can run Interest Based without entering an interest
  - Validation: document current behavior in the implementation summary before changing it

- [x] Add a product guard for missing Interest Based input
  - Modify: `components/Translator.tsx`
  - Preferred behavior:
    - If `Interest Based` is selected and the interest field is empty, do not silently send a generic interest-based request
    - Show a calm inline prompt to add an interest, or disable translation until an interest is entered
  - Keep copy short and practical
  - Validation: run the app locally and verify the user cannot submit an empty Interest Based request without clear guidance

- [x] Add server-side fallback protection for Interest Based
  - Modify: `services/translationPrompt.js`
  - If Interest Based reaches the prompt without an interest, avoid pretending a true interest is present
  - Use grounded low-pressure playfulness instead of themed language
  - Validation: call `/api/translate` with `tone: "Interest Based"` and no `interest`
  - Expected: response does not invent or imply a child interest

- [x] Update Interest Based eval fixtures
  - Modify: `evals/gemini-translation-prompt-set.json`
  - Modify: `evals/variation-prompt-set.json`
  - Include at least one realistic interest fixture for each core input
  - Include one missing-interest case to confirm fallback behavior
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: Interest Based should improve from `2.50/5` overall when a real interest is provided

## Phase 7: Rework Shorter Variation Behavior

- [x] Strengthen the `Shorter` variation instruction
  - Modify: `services/translationPrompt.js`
  - Target: `buildVariationPrompt`
  - Add constraints:
    - Shorter must preserve the original request’s core action
    - Shorter must preserve safety meaning, location, sequence, and destination when present
    - Shorter should compact phrasing, not switch to a weaker angle
    - If the source is already very short, produce a different compact version rather than deleting meaning
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected improvement: `Shorter` should improve from `2.53/5` and reduce fails from `17`

- [x] Decide whether the UI should continue swapping `Shorter` to `Longer` when Fewer Words is on
  - Inspect: `components/Translator.tsx`
  - Current behavior: `VARIATION_ORDER_FEWER_WORDS` uses `longer` instead of `shorter`
  - Decision options:
    - Keep current behavior and document it as intentional
    - Restore `Shorter` for all settings after prompt hardening
  - Validation: add the decision to the implementation summary and ensure eval coverage matches the chosen behavior

- [x] Update variation mock responses for `Shorter`
  - Modify: `server.js`
  - Target: `buildMockVariationTranslations`
  - Ensure mock `shorter` responses preserve key meaning instead of slicing words mechanically
  - Validation: run mock-mode variation curl tests against each selected source output
  - Expected: mock shorter outputs remain complete

## Phase 8: Protect Multi-Step Coverage

- [x] Add explicit destination preservation guidance
  - Modify: `services/translationPrompt.js`
  - Target: shared prompt coverage language
  - Add guidance that cleanup prompts must preserve where objects go, not just that cleanup is happening
  - Validation: run `node scripts/run-translation-output-eval.mjs`
  - Expected: `Pick up your toys and put them away upstairs in your room` improves from `3.00/5`, and destination loss is no longer a repeated risk

- [x] Add multi-step cleanup examples to mocks
  - Modify: `server.js`
  - Ensure mock output for cleanup mentions both toys and upstairs/room destination
  - Validation: mock-mode curl test for cleanup input across all tones
  - Expected: at least 3 of 4 mock outputs per tone preserve destination

- [x] Manually review Fewer Words multi-step outputs
  - Read: `evals/results/latest-translation-output-evaluation.md`
  - Focus on dinner and cleanup with `Fewer Words: On`
  - Validation: mark complete only if brevity does not erase sequence or destination

## Phase 9: Run Full Quality Evaluation

- [x] Run TypeScript validation
  - Command: `npm run lint`
  - Expected: `tsc` exits successfully

- [x] Run production build
  - Command: `npm run build`
  - Expected: build succeeds
  - Note: the existing Vite chunk-size warning is acceptable unless a new warning appears

- [x] Run the full translation output evaluation
  - Command: `node scripts/run-translation-output-eval.mjs`
  - Expected: new timestamped JSON and Markdown reports are written under `evals/results/`
  - Expected: `evals/results/latest-translation-output-evaluation.md` updates

- [x] Compare new results against the baseline
  - Translation average should improve from `2.83/5`
  - Translation fails should drop below `13`
  - `Stop running in the house` should improve from `2.00/5`
  - `Shorter` variation should improve from `2.53/5`
  - Humorous, Equalizing, and Interest Based should each improve or have a clear written explanation if one does not
  - Validation: add a before/after summary to the implementation notes

- [x] Manually inspect the new report for evaluator weirdness
  - Check whether any score looks obviously wrong because the evaluator misunderstood the output
  - Check whether any recommendation is too generic to act on
  - Validation: if the report builder needs normalization fixes, update `scripts/run-translation-output-eval.mjs` and rebuild latest Markdown with `node scripts/run-translation-output-eval.mjs --rebuild-latest`

## Phase 10: Browser And API Smoke QA

- [x] Start the local app
  - Command: `npm run dev`
  - Expected: app and API are available locally

- [x] Smoke test normal translation flow in the browser
  - Test all three inputs
  - Test `Default`, `Straightforward`, `Humorous`, `Equalizing`, and `Interest Based`
  - Test `Fewer Words` on and off
  - Validation: each run returns usable output and no visible UI errors

- [x] Smoke test Interest Based missing-interest behavior
  - Select `Interest Based`
  - Leave interest empty
  - Try to submit
  - Expected: the UI gives clear guidance or prevents submission without a confusing failure

- [x] Smoke test variation chips
  - Select one output
  - Test `Shorter`, `Warmer`, `More straightforward`, and `More playful`
  - If `Fewer Words` still swaps `Shorter` to `Longer`, verify that behavior is intentional and documented
  - Validation: variations appear inline, remain low-pressure, and do not drop important details

- [x] Confirm Recent/history behavior still works
  - Generate a translation
  - Generate at least one variation
  - Open Recent and restore the run
  - Expected: no duplicate Recent entries, source outputs and cached variations behave as before

## Phase 11: Final Review And Shipping Decision

- [x] Review changed files
  - Command: `git diff -- services/translationPrompt.js server.js components/Translator.tsx evals scripts TODO.md`
  - Expected: changes are limited to prompt behavior, UI guardrails, mocks, eval artifacts, and this checklist

- [x] Confirm no unrelated generated files need to be removed
  - Command: `git status --short`
  - Expected: only intentional files are listed

- [x] Write a concise implementation summary
  - Include:
    - What changed
    - Which baseline metrics improved
    - Which weak spots remain
    - Any product decisions, especially Interest Based guardrails and Fewer Words variation chips
    - Validation commands run

- [x] Hold before deployment unless explicitly asked to deploy
  - Do not run `npm run deploy` until Kyle asks for deployment
  - If deployment is requested, run:
    - `npm run lint`
    - `npm run build`
    - `npm run deploy`
  - Validation after deploy: confirm the Cloud Run URL and `https://declarativeapp.org` return HTTP 200

## Acceptance Criteria

- [ ] Translation average improves above `2.83/5`
- [ ] Translation fails drop below `13`
- [x] `Stop running in the house` improves above `2.00/5`
- [x] `Shorter` variation improves above `2.53/5`
- [ ] Humorous outputs are lighter without being gimmicky
- [x] Equalizing outputs show natural status-leveling without repeating one template
- [x] Interest Based does not pretend a generic interest exists
- [x] Fewer Words remains complete for dinner and cleanup prompts
- [x] `npm run lint` passes
- [x] `npm run build` passes
- [x] Browser smoke QA passes
- [ ] Kyle reviews the final report before deployment
