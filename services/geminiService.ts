import type { Translation } from '../types';

// Client-Side Rate Limiting (UX guard, not a security measure)
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 5;
const STORAGE_KEY = 'api_request_timestamps';

const checkRateLimit = (): void => {
  try {
    const now = Date.now();
    const storedTimestamps = localStorage.getItem(STORAGE_KEY);
    const timestamps: number[] = storedTimestamps ? JSON.parse(storedTimestamps) : [];

    const validTimestamps = timestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);

    if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const oldestTimestamp = validTimestamps[0];
      const waitTimeSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp)) / 1000);
      throw new Error(`Rate limit reached. Please wait ${waitTimeSeconds} seconds before trying again.`);
    }

    validTimestamps.push(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validTimestamps));
  } catch (error) {
    if (error instanceof Error && error.message.includes('Rate limit reached')) {
      throw error;
    }
    console.warn('LocalStorage rate limit check failed:', error);
  }
};

export const getDeclarativeTranslations = async (
  imperativeText: string,
  existingTranslations: Translation[] = [],
  tone?: string,
  interest?: string,
  useFewerWords?: boolean
): Promise<Translation[]> => {
  checkRateLimit();

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: imperativeText,
        existingTranslations,
        tone,
        interest,
        useFewerWords,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed.' }));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Translation Error:', error);
    throw new Error(error instanceof Error ? error.message : 'AI translation unavailable.');
  }
};