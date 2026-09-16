import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOURTEEN_DAYS_MS,
  THIRTY_DAYS_MS,
  NINETY_DAYS_MS,
  SNOOZE_KEY,
  SHOWN_SESSION_KEY,
  TRANSLATION_COUNT_KEY,
  getSnoozedUntil,
  isSupporterCardSnoozed,
  snoozeSupporterCard,
  isShownThisSession,
  markShownThisSession,
  getLifetimeTranslationCount,
  incrementLifetimeTranslationCount,
  shouldShowSupporterCard,
} from '../services/supporterCardStorage.ts';

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

test('supporterCardStorage: First run grace (count < 2)', () => {
  const local = new MockStorage();
  const session = new MockStorage();

  // 0 translations -> should NOT show
  assert.equal(shouldShowSupporterCard({ localStorage: local, sessionStorage: session }), false);

  // 1 translation -> should NOT show
  local.setItem(TRANSLATION_COUNT_KEY, '1');
  assert.equal(shouldShowSupporterCard({ localStorage: local, sessionStorage: session }), false);

  // 2 translations -> should show
  local.setItem(TRANSLATION_COUNT_KEY, '2');
  assert.equal(shouldShowSupporterCard({ localStorage: local, sessionStorage: session }), true);
});

test('supporterCardStorage: Session throttling (max 1 per session)', () => {
  const local = new MockStorage();
  const session = new MockStorage();
  local.setItem(TRANSLATION_COUNT_KEY, '5');

  // Not shown yet -> should show
  assert.equal(shouldShowSupporterCard({ localStorage: local, sessionStorage: session }), true);

  // Mark shown in session
  markShownThisSession(session);
  assert.equal(isShownThisSession(session), true);

  // After being shown -> should NOT show again in same session
  assert.equal(shouldShowSupporterCard({ localStorage: local, sessionStorage: session }), false);
});

test('supporterCardStorage: Snooze 14 days logic and expiration boundary', () => {
  const local = new MockStorage();
  const session = new MockStorage();
  local.setItem(TRANSLATION_COUNT_KEY, '3');

  const now = 1700000000000;

  // 1. Initially qualified
  assert.equal(shouldShowSupporterCard({ currentTime: now, localStorage: local, sessionStorage: session }), true);

  // 2. User clicks Snooze 14 days
  const snoozedUntil = snoozeSupporterCard(FOURTEEN_DAYS_MS, now, local);
  assert.equal(snoozedUntil, now + FOURTEEN_DAYS_MS);
  assert.equal(local.getItem(SNOOZE_KEY), String(now + FOURTEEN_DAYS_MS));

  // 3. 1 hour later: still snoozed
  assert.equal(isSupporterCardSnoozed(now + 3600000, local), true);
  assert.equal(shouldShowSupporterCard({ currentTime: now + 3600000, localStorage: local, sessionStorage: session }), false);

  // 4. 7 days later: still snoozed
  const sevenDaysLater = now + (7 * 24 * 60 * 60 * 1000);
  assert.equal(isSupporterCardSnoozed(sevenDaysLater, local), true);
  assert.equal(shouldShowSupporterCard({ currentTime: sevenDaysLater, localStorage: local, sessionStorage: session }), false);

  // 5. 13 days, 23 hours later: still snoozed
  const almostFourteenDays = now + FOURTEEN_DAYS_MS - 1000;
  assert.equal(isSupporterCardSnoozed(almostFourteenDays, local), true);
  assert.equal(shouldShowSupporterCard({ currentTime: almostFourteenDays, localStorage: local, sessionStorage: session }), false);

  // 6. Exactly 14 days later: snooze expired!
  const fourteenDaysLater = now + FOURTEEN_DAYS_MS;
  assert.equal(isSupporterCardSnoozed(fourteenDaysLater, local), false);
  assert.equal(shouldShowSupporterCard({ currentTime: fourteenDaysLater, localStorage: local, sessionStorage: session }), true);
});

test('supporterCardStorage: More ways to support sets 30-day snooze', () => {
  const local = new MockStorage();
  const now = 1700000000000;

  const snoozedUntil = snoozeSupporterCard(THIRTY_DAYS_MS, now, local);
  assert.equal(snoozedUntil, now + THIRTY_DAYS_MS);
  assert.equal(isSupporterCardSnoozed(now + (29 * 24 * 60 * 60 * 1000), local), true);
  assert.equal(isSupporterCardSnoozed(now + THIRTY_DAYS_MS, local), false);
});

test('supporterCardStorage: Increments translation count reliably', () => {
  const local = new MockStorage();

  assert.equal(getLifetimeTranslationCount(local), 0);
  assert.equal(incrementLifetimeTranslationCount(local), 1);
  assert.equal(getLifetimeTranslationCount(local), 1);
  assert.equal(incrementLifetimeTranslationCount(local), 2);
  assert.equal(getLifetimeTranslationCount(local), 2);

  // Handles corrupt/malformed values gracefully
  local.setItem(TRANSLATION_COUNT_KEY, 'not_a_number');
  assert.equal(getLifetimeTranslationCount(local), 0);
  assert.equal(incrementLifetimeTranslationCount(local), 1);
});
