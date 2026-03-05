import posthog from 'posthog-js';

/**
 * Identifies a user in PostHog. Call this function when a user logs in.
 * @param userId - A unique identifier for the user.
 * @param properties - Optional custom properties to associate with the user.
 */
export const identifyUser = (userId: string, properties?: Record<string, any>) => {
  posthog.identify(userId, properties);
};

/**
 * Tracks a custom event in PostHog.
 * @param eventName - The name of the event to track.
 * @param properties - Optional properties to send with the event.
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  posthog.capture(eventName, properties);
};
