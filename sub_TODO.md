# Subscription Support Page Implementation TODO

## Working Rules

- [ ] Read these rules before starting any implementation work.
  - Only check off an item after the code or configuration for that step has been implemented, tested, and confirmed complete.
  - Do not move to the next unchecked step until the user explicitly says to proceed.
  - If testing reveals a problem, leave the item unchecked, fix the issue, and re-test before checking it off.
  - Keep changes scoped to the current step only unless a blocker makes a small supporting change unavoidable.
  - Do not start any step automatically after finishing the previous one. Pause and wait for user initiation every time.

## Reference Links

- Monthly Subscription Link: `https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405`
- Customer Portal Link: `https://billing.stripe.com/p/login/4gM00ce9g2yX9zPbYxfw400`

## Stage 1: Confirm Current Baseline and Scope

- [x] Review the current `/coffee` implementation and confirm the exact files involved before editing anything.
  - Focus on the current payment link logic, layout structure, and any legal/support copy already shown to users.
  - Likely files:
    - `components/CoffeePage.tsx`
    - `constants/termsOfService.tsx`
    - Any shared support CTA/copy locations if needed
- [x] Run baseline verification before changes.
  - Recommended checks:
    - `npm run lint`
    - `npm run build`
  - Record whether the baseline passes before implementation begins.
  - Baseline result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced a non-blocking Vite chunk-size warning only
- [ ] Pause for user approval before starting Stage 2.

## Stage 2: Add Stripe Link Configuration for Monthly Support

- [x] Update the support link configuration so the app has a dedicated recurring monthly link and a customer portal management link.
  - Keep the existing one-time donation links intact.
  - Add the provided monthly subscription link.
  - Add the provided customer portal link.
  - Keep the implementation client-side only for this stage.
- [x] Verify the code structure after the link update.
  - Confirm no existing one-time donation behavior was accidentally removed.
  - Confirm the monthly and portal links are stored in a clear, maintainable place.
- [x] Run testing for this stage.
  - `npm run lint`
  - `npm run build`
  - Stage 2 result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced the same non-blocking Vite chunk-size warning
- [x] Manually inspect the code diff to confirm only link/config logic changed in this stage.
- [ ] Pause for user approval before starting Stage 3.

## Stage 3: Separate One-Time and Monthly Support Logic in the Coffee Module

- [x] Refactor the `/coffee` interaction logic so one-time and recurring support are treated as distinct actions.
  - One-time support should continue using selectable donation amounts.
  - Monthly support should use its own dedicated CTA flow.
  - Customer portal access should be separate from the donation selection flow.
- [x] Verify the component behavior logic.
  - Confirm one-time selection still requires choosing an option before its CTA.
  - Confirm monthly support does not interfere with one-time state.
  - Confirm customer portal access is independent and clear.
- [x] Run testing for this stage.
  - `npm run lint`
  - `npm run build`
  - Stage 3 result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced the same non-blocking Vite chunk-size warning
- [x] Manually test behavior in the browser.
  - Confirm one-time support still opens the expected Stripe link.
  - Confirm monthly support opens the monthly Stripe link.
  - Confirm the customer portal link opens the Stripe billing portal.
  - Browser verification result on 2026-04-20:
    - `Support Once` was disabled until a one-time amount was selected
    - One-time `$3` support opened `https://buy.stripe.com/9B628kghogpNcM10fPfw402`
    - Monthly support opened `https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405`
    - Manage monthly support opened `https://billing.stripe.com/p/login/4gM00ce9g2yX9zPbYxfw400`
- [ ] Pause for user approval before starting Stage 4.

## Stage 4: Redesign the Buy Me a Coffee Layout

- [x] Redesign the support module to clearly distinguish one-time support from recurring monthly support.
  - Create two clearly labeled sections or cards inside the module.
  - Make the recurring option visually distinct without overpowering the one-time options.
  - Ensure the design still fits the current site style.
- [x] Implement responsive layout behavior.
  - Desktop: ensure the module lays out cleanly with enough room for both support types.
  - Mobile: ensure the sections stack cleanly with readable spacing and obvious CTAs.
- [x] Verify clarity of the visual hierarchy.
  - The user should immediately understand:
    - which option is one-time
    - which option is recurring
    - where to manage/cancel recurring support
- [x] Run testing for this stage.
  - `npm run lint`
  - `npm run build`
  - Stage 4 result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced the same non-blocking Vite chunk-size warning
- [x] Perform manual browser testing.
  - Test desktop width
  - Test mobile width
  - Confirm no overflow, cramped layout, or ambiguous copy
  - Browser verification result on 2026-04-20:
    - Desktop width (`1440px`) showed the one-time and monthly cards side by side with matching top alignment
    - Mobile width (`390px`) stacked the cards vertically with no horizontal overflow
    - Desktop and mobile both kept the support module fully within viewport width
  - Refinement verification result on 2026-04-20:
    - The support module was normalized to better match the site's simpler white-card pattern
    - The clipped top-gradient treatment was replaced with a softer full-surface background wash
    - Desktop and mobile both confirmed the page can still scroll to the footer area
- [ ] Pause for user approval before starting Stage 5.

## Stage 5: Update Support Copy and Terms Language

- [x] Update on-page support copy so recurring billing is explicitly explained.
  - Add language such as:
    - one-time support is charged once
    - monthly support renews every month
    - monthly support can be managed or canceled through Stripe
- [x] Update terms language if needed to reflect recurring monthly support.
  - Preserve the existing “voluntary support” and “no goods/services” positioning.
  - Clarify cancellation expectations for recurring support.
- [x] Review surrounding copy for consistency.
  - Ensure button labels, helper text, and legal references do not conflict with the new recurring option.
- [x] Run testing for this stage.
  - `npm run lint`
  - `npm run build`
  - Stage 5 result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced the same non-blocking Vite chunk-size warning
- [x] Manually review the rendered copy for clarity and tone.
  - Rendered copy review result on 2026-04-20:
    - The support module now states that one-time gifts are charged once
    - The monthly support copy now states that it renews until canceled in Stripe
    - The terms now explicitly cover recurring monthly support and cancellation timing
- [ ] Pause for user approval before starting Stage 6.

## Stage 6: End-to-End Verification

- [x] Perform a complete manual walkthrough of the updated `/coffee` page.
  - Validate the one-time flow.
  - Validate the monthly support flow.
  - Validate the customer portal link.
  - Validate the distinction between one-time and recurring support on both desktop and mobile.
  - End-to-end verification result on 2026-04-20:
    - One-time `$3` support opened `https://buy.stripe.com/9B628kghogpNcM10fPfw402`
    - Monthly support opened `https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405`
    - Manage monthly support opened `https://billing.stripe.com/p/login/4gM00ce9g2yX9zPbYxfw400`
    - Deep link `#/coffee/donate` loaded the coffee page and auto-scrolled near the donation module
    - Desktop and mobile both scrolled to the footer successfully
- [x] Run final verification checks.
  - `npm run lint`
  - `npm run build`
  - Stage 6 result on 2026-04-20:
    - `npm run lint` passed
    - `npm run build` passed
    - Build produced the same non-blocking Vite chunk-size warning
- [x] Review the final diff for accidental scope creep.
  - Confirm no unrelated files were changed without intention.
  - Confirm this work did not introduce backend Stripe dependencies unless explicitly requested later.
- [x] Prepare a concise summary of what changed, what was tested, and any follow-up recommendations.
- [x] Stop and wait for user direction before any additional cleanup, polish, or deployment work.

## Optional Future Stage: Post-Implementation Enhancements

- [ ] Decide later whether to add any of the following after the main implementation is complete:
  - analytics for one-time vs monthly support clicks
  - success-state messaging after returning from Stripe
  - a more prominent recurring supporter highlight or badge
  - additional support tiers or yearly options
