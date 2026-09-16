# Session Handoff: In-Feed Supporter Card & Conversion Optimization

> **Date**: September 15, 2026  
> **Author**: Kyle Wegner & Antigravity (Project Hail Mary Command Center)  
> **Status**: Deployed to Production (Cloud Run)  
> **Git Commit**: [`abd5ea3`](https://github.com/metaky/declarative/commit/abd5ea3) on `origin/main`  
> **Production Service**: `https://declarative-1083695383503.us-west1.run.app`  

---

## 1. Executive Context & Problem Solved

### The Problem
* **The Permanent Muting Bug**: In the legacy `DonationCallout.tsx`, clicking "Do not show again" set `localStorage.setItem('hideDonationPermanently', 'true')`. Over time, as traffic shifted from new visitors to loyal repeat families, the vast majority of active users permanently silenced the donation banner.
* **Intrusive Top Banner**: The legacy amber banner sat above the main input box, pushing the textarea down and creating cognitive noise for parents arriving in active crisis/triage.

### The Solution
* **Unobtrusive In-Feed Card**: Moved the support prompt inside the translation results stream, positioned cleanly after Translation Card #2.
* **Non-Clinical Copy**: Avoids the word "AI" to keep tone warm, grounded, and human:
  > *💛 Kept free by sustaining families*  
  > *Running this site costs real server fees. If Declarative helps your home, join our monthly supporters.*
* **Conversion Optimization**:
  * Primary Button: `Give $5/mo` (Direct Stripe recurring subscription).
  * Secondary Button: `More ways to support` (Transitions to `#/coffee/donate` and auto-scrolls directly to `#donate-section` where $3, $8, and Custom amount options are prominent).
  * Dismissal: `✕` / `Snooze 14d` (Temporary snooze instead of permanent lifetime muting).

---

## 2. Architecture & File Breakdown

### New Files Created
1. **[`services/supporterCardStorage.ts`](file:///Users/kyle.wegner/Dev%20Projects/Declarative/services/supporterCardStorage.ts)**:
   * Encapsulates all storage operations, timestamps, and guard conditions.
   * Keys used:
     * `declarative_supporter_snoozed_until` (`localStorage` timestamp)
     * `declarative_supporter_shown_this_session` (`sessionStorage` boolean)
     * `declarative_lifetime_translations` (`localStorage` integer count)
   * Functions: `shouldShowSupporterCard`, `snoozeSupporterCard`, `markShownThisSession`, `incrementLifetimeTranslationCount`.
2. **[`components/InFeedSupporterCard.tsx`](file:///Users/kyle.wegner/Dev%20Projects/Declarative/components/InFeedSupporterCard.tsx)**:
   * Renders the subdued amber-tinted card between Card 2 and Card 3.
   * Handles 14-day snooze, 30-day snooze on "More ways to support", and router navigation.
3. **[`test/supporter-card-storage.test.mjs`](file:///Users/kyle.wegner/Dev%20Projects/Declarative/test/supporter-card-storage.test.mjs)**:
   * 5 automated unit tests verifying first-run grace, session throttling, snooze boundary calculations, and storage corruption resilience.

### Modified Files
1. **[`components/Translator.tsx`](file:///Users/kyle.wegner/Dev%20Projects/Declarative/components/Translator.tsx)**:
   * Removed legacy `<DonationCallout />` from above the textarea (line 834).
   * Renders `<InFeedSupporterCard />` after translation index 1.
   * Calls `incrementLifetimeTranslationCount()` upon successful translation runs.

---

## 3. Frequency Capping & Protection Rules

| Rule | Behavior | Implementation |
| :--- | :--- | :--- |
| **Rule 1: First-Run Grace** | Card never shows on a user's very first translation run. Requires `lifetimeCount >= 2`. | `declarative_lifetime_translations` in `localStorage` |
| **Rule 2: Max 1 Per Session** | If a user translates multiple times in one sitting, card only shows on the first qualified run. | `sessionStorage.setItem('declarative_supporter_shown_this_session', 'true')` |
| **Rule 3: 14-Day Snooze** | Tapping `✕` or "Snooze 14d" silences the card for 14 days. | `Date.now() + 14 * 24 * 60 * 60 * 1000` in `localStorage` |
| **Rule 4: Support Click Snooze** | Tapping "More ways to support" or "Give $5/mo" snoozes the card for 30–90 days. | `snoozeSupporterCard(THIRTY_DAYS_MS)` |

---

## 4. Verification & Testing History

* **Unit Tests**: `node --test` runs 168 tests (168 passed, 0 failed).
* **TypeScript**: `tsc` passed with zero diagnostics.
* **Production Build**: `vite build` completed cleanly in 4.08s.
* **Production Deployment**: Shipped via `gcloud run deploy` to Cloud Run revision `declarative-35lite-morelike-health` serving 100% of traffic. Verified via `/api/healthz` (`200 OK`).

---

## 5. How to Continue Development in Future Sessions

When opening a new session in `/Users/kyle.wegner/Dev Projects/Declarative`:

```bash
# 1. Run local dev server (Frontend + Express API with mock translations)
npm run dev

# 2. Run full test & lint verification
npm run check

# 3. Deploy updates to Cloud Run
npm run deploy
```

### Local Dev Note on Gemini Mock Mode
* In `.env.local`, `DEV_USE_MOCK_TRANSLATIONS=true` is enabled to allow local UI testing without requiring an active Gemini API key.
* Safety rail: `server.js` hardcodes `process.env.NODE_ENV !== 'production'`, ensuring mock mode is physically impossible to trigger in production on Cloud Run.
