import posthog from 'posthog-js';

export const ANALYTICS_OPT_OUT_STORAGE_KEY = 'declarative_analytics_opt_out';

export const isAnalyticsOptedOut = (
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): boolean => {
  try {
    if (storage?.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === 'true') {
      return true;
    }
    if (typeof posthog?.has_opted_out_capturing === 'function') {
      return Boolean(posthog.has_opted_out_capturing());
    }
  } catch {
    // Ignore storage/PostHog inspection errors
  }
  return false;
};

export const setAnalyticsOptOut = (
  optOut: boolean,
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): void => {
  try {
    if (storage) {
      if (optOut) {
        storage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, 'true');
      } else {
        storage.removeItem(ANALYTICS_OPT_OUT_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage errors
  }

  try {
    if (optOut && typeof posthog?.opt_out_capturing === 'function') {
      posthog.opt_out_capturing();
    } else if (!optOut && typeof posthog?.opt_in_capturing === 'function') {
      posthog.opt_in_capturing();
    }
  } catch {
    // Ignore PostHog errors if blocked by browser/extension
  }
};

/**
 * Identifies a user in PostHog. Call this function when a user logs in.
 * @param userId - A unique identifier for the user.
 * @param properties - Optional custom properties to associate with the user.
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  if (isAnalyticsOptedOut()) return;
  try {
    posthog.identify(userId, properties);
  } catch {
    // Ignore analytics errors
  }
};

/**
 * Tracks a custom event in PostHog.
 * @param eventName - The name of the event to track.
 * @param properties - Optional properties to send with the event.
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (isAnalyticsOptedOut()) return;
  try {
    posthog.capture(eventName, properties);
  } catch {
    // Ignore analytics errors
  }
};
