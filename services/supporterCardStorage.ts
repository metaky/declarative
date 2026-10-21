export const SUPPORT_LINKS = {
  oneTime: {
    small: 'https://buy.stripe.com/9B628kghogpNcM10fPfw402',
    large: 'https://donate.stripe.com/7sY4gs7KS2yXaDT8Mlfw403',
    custom: 'https://buy.stripe.com/4gM00ce9g2yX9zPbYxfw400',
  },
  monthly: 'https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405',
  manageMonthly: 'https://billing.stripe.com/p/login/4gM00ce9g2yX9zPbYxfw400',
} as const;

export const SNOOZE_KEY = 'declarative_supporter_snoozed_until';
export const SHOWN_SESSION_KEY = 'declarative_supporter_shown_this_session';
export const TRANSLATION_COUNT_KEY = 'declarative_lifetime_translations';

export const BANNER_SNOOZE_KEY = 'declarative_banner_snoozed_until';
export const BANNER_DISMISSED_SESSION_KEY = 'declarative_banner_dismissed_session';

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
  if (snoozedUntil > 0 && currentTime < snoozedUntil) {
    return true;
  }
  return isDonationBannerSnoozed(currentTime, storage);
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
    return (
      storage.getItem(SHOWN_SESSION_KEY) === 'true' ||
      storage.getItem(BANNER_DISMISSED_SESSION_KEY) === 'true'
    );
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

export function getBannerSnoozedUntil(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): number {
  try {
    if (!storage) return 0;
    const value = storage.getItem(BANNER_SNOOZE_KEY);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function isDonationBannerSnoozed(
  currentTime: number = Date.now(),
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): boolean {
  const snoozedUntil = getBannerSnoozedUntil(storage);
  return snoozedUntil > 0 && currentTime < snoozedUntil;
}

export function isBannerDismissedThisSession(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): boolean {
  try {
    if (!storage) return false;
    return storage.getItem(BANNER_DISMISSED_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

export function dismissDonationBannerForSession(
  sessionStorage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): void {
  try {
    if (sessionStorage) {
      sessionStorage.setItem(BANNER_DISMISSED_SESSION_KEY, 'true');
      sessionStorage.setItem(SHOWN_SESSION_KEY, 'true');
    }
  } catch {
    // Ignore storage errors
  }
}

export function snoozeDonationBanner(
  durationMs: number = THIRTY_DAYS_MS,
  currentTime: number = Date.now(),
  localStorage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null,
  sessionStorage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): number {
  const targetTime = currentTime + durationMs;
  try {
    if (localStorage) {
      localStorage.setItem(BANNER_SNOOZE_KEY, String(targetTime));
      localStorage.setItem(SNOOZE_KEY, String(targetTime));
    }
  } catch {
    // Ignore storage errors
  }
  try {
    if (sessionStorage) {
      sessionStorage.setItem(BANNER_DISMISSED_SESSION_KEY, 'true');
      sessionStorage.setItem(SHOWN_SESSION_KEY, 'true');
    }
  } catch {
    // Ignore storage errors
  }
  return targetTime;
}

export function restoreDonationBannerSession(
  sessionStorage: Pick<Storage, 'removeItem'> | null = typeof window !== 'undefined' ? window.sessionStorage : null
): void {
  try {
    if (sessionStorage) {
      sessionStorage.removeItem(BANNER_DISMISSED_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function shouldShowDonationBanner({
  currentTime = Date.now(),
  localStorage = typeof window !== 'undefined' ? window.localStorage : null,
  sessionStorage = typeof window !== 'undefined' ? window.sessionStorage : null,
}: {
  currentTime?: number;
  localStorage?: Pick<Storage, 'getItem'> | null;
  sessionStorage?: Pick<Storage, 'getItem'> | null;
} = {}): boolean {
  if (isDonationBannerSnoozed(currentTime, localStorage)) {
    return false;
  }
  if (isBannerDismissedThisSession(sessionStorage)) {
    return false;
  }
  return true;
}
