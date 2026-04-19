# One-Tap Variations Prelaunch Checklist

Use this checklist to decide whether the inline one-tap variations feature is ready to ship. Treat the **Must Do Before Launch** items as blocking. The **Nice To Have After Launch** items can be handled after release if the blocking items are solid.

## Must Do Before Launch

- [x] Verify the feature in a production-like environment with real challenge tokens enabled.
  Confirm rapid variation clicks never fail because of expired or single-use token collisions.

- [x] Test real rate-limit behavior for natural exploration.
  Confirm variation-specific `429` responses show inline, stay calm, and do not break the main translation experience.

- [x] Do a mobile layout pass on small phone widths.
  Check chip wrapping, panel spacing, copy buttons, and that the inline refinement area still feels light rather than crowded.

- [x] Do a keyboard and screen reader pass on the variation panel in [components/Translator.tsx](/Users/kyle.wegner/Dev Projects/declarative/components/Translator.tsx).
  Verify focus order, visible focus states, selected-chip state, and inline loading and error announcements.

- [x] Manually review outputs from [latest-variation-prompt-review.md](/Users/kyle.wegner/Dev Projects/declarative/evals/results/latest-variation-prompt-review.md) for subtle tone drift.
  Focus most on:
  `Straightforward` + `More straightforward`
  `Humorous` + `More playful`
  `Interest Based` + `More playful`
  `Fewer Words` + `Longer`
  multi-part prompts in any variation mode

- [x] Test a few longer and messier real-world prompts, not just the clean dinner example.
  Make sure shortening and straightforward refinements do not drop important parts.

- [x] Confirm analytics events are arriving for the new fields in [services/geminiService.ts](/Users/kyle.wegner/Dev Projects/declarative/services/geminiService.ts) and [server.js](/Users/kyle.wegner/Dev Projects/declarative/server.js):
  `mode`
  `variation_kind`
  `cache_hit`
  `aborted`
  `stale_ignored`

- [x] Verify Recent persistence feels clean:
  one run stays one Recent item
  refinements restore correctly
  restored panels are collapsed
  no confusing duplication appears after refresh or reopen

## Nice To Have After Launch

- [ ] Watch whether people actually use the feature as expected.
  Check which chips get used most, how often cached results are revisited, and whether variation rate limits are being hit in normal usage.

- [x] Review whether the inline saved or cached behavior is obvious enough.
  Decide whether the UI needs slightly clearer microcopy.

- [ ] Add more eval cases for especially delicate prompts.
  Good candidates include conflict, urgency, and emotionally charged parent language.

- [ ] Monitor localStorage or history growth over time now that nested variation results are saved in [services/historyStorage.ts](/Users/kyle.wegner/Dev Projects/declarative/services/historyStorage.ts).

- [ ] Consider a small post-launch polish pass if needed:
  refine loading copy
  refine inline error copy
  tune chip labels if one proves confusing in practice

- [ ] Revisit prompt tuning if review data shows one variation type underperforming.
  Watch especially for `More playful` and `Longer`.

## Ship Decision Rule

- [x] Ship if all of these are true:
  production-like token and rate-limit behavior is solid
  mobile and accessibility checks pass
  prompt review still feels safe and useful across the highest-risk combinations

- [x] Hold if any of these are true:
  any variation mode regularly drops task coverage
  any mode starts sounding subtly bossy, manipulative, or gimmicky
  the inline UI feels cluttered or confusing on mobile

## Working Notes

Use this section to record what we learn while we work through the checklist together.

- Date: 2026-04-19
- Environment: Local Vite client on `3000` with local API on `3002`, `DEV_BYPASS_CHALLENGE=false`, real Upstash-backed challenge tokens enabled
- Reviewer: Codex + user
- Notes:
  - Verified `/api/challenge` returns live one-time challenge ids in this mode.
  - Verified a normal variation click succeeds end-to-end through the real challenge-token flow with `200` on both `/api/challenge` and `/api/translate`.
  - Verified rapid chip switching did **not** produce any `403 Invalid or expired session` failures.
  - Under rapid chip switching, the UI surfaced the intended inline “A lot of versions were tried quickly...” message rather than a token-collision error.
  - Verified real server-side variation burst limiting by forcing the fourth uncached variation request within the burst window to return `/api/translate` `429`.
  - Verified that the `429` message stayed inline in the variation panel and did not replace or break the main translation results.
  - Mobile pass on a small phone viewport looked clean: chips wrapped into two rows without overlap, copy buttons remained visible, and the inline refinement area stayed readable instead of cramped.
  - Keyboard tab order through the open variation panel was logical: selected chip, remaining chips, then the variation copy buttons.
  - Focus styling was clearly visible on keyboard focus.
  - Accessibility follow-up patch added `aria-expanded`/`aria-controls` to the panel toggle, `aria-pressed` to the selected variation chip, `role="status"` with polite live announcements for loading, and `role="alert"` for inline variation errors.
  - Prompt review was spot-checked again across the highest-risk combinations in the generated report, with special attention to `Straightforward + More straightforward`, `Humorous + More playful`, `Interest Based + More playful`, `Fewer Words + Longer`, and the equalizing multi-part case.
  - No blocking prompt failures were found in that pass: task coverage stayed intact, tone stayed within the Declarative range, and the outputs remained usable.
  - The main residual risk is conservatism rather than safety drift: a few `More playful` and `More straightforward` variants are only moderately more distinct rather than dramatically different, but they still read as valid refinements.
  - Real-world prompt pass covered longer, messier prompts with multiple steps and ambient context, including a school-leaving sequence and a dinner + Lego cleanup sequence.
  - In those live tests, `Shorter` and `More straightforward` kept the important task pieces intact rather than collapsing the prompt down to only one step.
  - One mild watch-out remains: the model can preserve extra scene detail from the original messy prompt more than strictly necessary, but it did not create blocking task loss in this pass.
  - Recent persistence had already been validated in earlier manual QA: one translation run stays one Recent item, saved refinements restore with the run, restored variation panels reopen collapsed, and no confusing duplication was observed.
  - Analytics verification was resolved by tracing the PostHog client directly in the browser.
  - The earlier false negative came from headless Playwright being identified as a bot (`HeadlessChrome` user agent). In that state, PostHog returns early from `capture()` before emitting or sending the event.
  - After temporarily bypassing the bot filter in the test browser, the event moved through the normal path and a live analytics request was observed: `POST https://us.i.posthog.com/i/v0/e/ ... => 200`.
  - Conclusion: the analytics path itself is working; the local headless QA environment was suppressing custom event capture by design.
  - User manually confirmed that the variation chips feel intuitive in use.
  - User manually confirmed that the variation results feel meaningfully different enough to justify the feature.
  - User manually confirmed that Recent still feels clean even after a lot of feature play.
  - User manually confirmed that the UI does not feel crowded or confusing on either mobile or desktop.
  - Based on the combined manual QA and earlier technical checks, the current build meets the prelaunch ship criteria and does not trigger the current hold criteria.
