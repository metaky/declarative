export const SNOOZE_KEY = 'declarative_supporter_snoozed_until';
export const SHOWN_SESSION_KEY = 'declarative_supporter_shown_this_session';
export const TRANSLATION_COUNT_KEY = 'declarative_lifetime_translations';

export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
export const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export function getSnoozedUntil(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): number {
  try {
    if (!storage) return 0;
    const value = storage.getItem(SNOOZE_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function isSupporterCardSnoozed(
  currentTime: number = Date.now(),
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): boolean {
  const snoozedUntil = getSnoozedUntil(storage);
  return snoozedUntil > 0 && currentTime < snoozedUntil;
}

export function snoozeSupporterCard(
  durationMs: number = FOURTEEN_DAYS_MS,
  currentTime: number = Date.now(),
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): number {
  const targetTime = currentTime + durationMs;
  try {
    if (storage) {
      storage.setItem(SNOOZE_KEY, String(targetTime));
    }
  } catch {
    // Ignore storage errors
  }
  return targetTime;
}

export function isShownThisSession(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): boolean {
  try {
    if (!storage) return false;
    return storage.getItem(SHOWN_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markShownThisSession(
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): void {
  try {
    if (storage) {
      storage.setItem(SHOWN_SESSION_KEY, 'true');
    }
  } catch {
    // Ignore storage errors
  }
}

export function getLifetimeTranslationCount(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): number {
  try {
    if (!storage) return 0;
    const value = storage.getItem(TRANSLATION_COUNT_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function incrementLifetimeTranslationCount(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): number {
  const current = getLifetimeTranslationCount(storage);
  const next = current + 1;
  try {
    if (storage) {
      storage.setItem(TRANSLATION_COUNT_KEY, String(next));
    }
  } catch {
    // Ignore storage errors
  }
  return next;
}

export function shouldShowSupporterCard({
  currentTime = Date.now(),
  localStorage = typeof window !== 'undefined' ? window.localStorage : null,
  sessionStorage = typeof window !== 'undefined' ? window.sessionStorage : null,
}: {
  currentTime?: number;
  localStorage?: Pick<Storage, 'getItem'> | null;
  sessionStorage?: Pick<Storage, 'getItem'> | null;
} = {}): boolean {
  if (isSupporterCardSnoozed(currentTime, localStorage)) {
    return false;
  }
  if (isShownThisSession(sessionStorage)) {
    return false;
  }
  if (getLifetimeTranslationCount(localStorage) < 2) {
    return false;
  }
  return true;
}
