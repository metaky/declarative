import type { RequestMode, Translation, VariationKind } from '../types';
import { ensureTranslations } from './translationUtils';
import posthog from 'posthog-js';

interface TranslateRequestOptions {
  imperativeText: string;
  mode: RequestMode;
  existingTranslations?: Translation[];
  tone?: string;
  interest?: string;
  useFewerWords?: boolean;
  sourceTranslation?: Translation;
  variationKind?: VariationKind;
  signal?: AbortSignal;
}

interface ClientRateLimitState {
  translate: number[];
  moreIdeas: number[];
  variation: number[];
  variationBurst: number[];
}

const RATE_LIMIT_STORAGE_KEY = 'api_request_timestamps_v2';
const DEFAULT_RATE_LIMIT_STATE: ClientRateLimitState = {
  translate: [],
  moreIdeas: [],
  variation: [],
  variationBurst: [],
};

const RATE_LIMIT_WINDOW_MS = 60000;
const VARIATION_BURST_WINDOW_MS = 10000;
const TRANSLATE_MAX_REQUESTS_PER_WINDOW = 6;
const VARIATION_MAX_REQUESTS_PER_WINDOW = 8;
const VARIATION_MAX_REQUESTS_PER_BURST = 3;

const captureRateLimitEvent = (
  source: 'client' | 'server',
  waitSeconds: number,
  mode: RequestMode,
  variationKind?: VariationKind
) => {
  try {
    posthog.capture('rate_limit_hit', {
      source,
      mode,
      variation_kind: variationKind,
      wait_seconds: waitSeconds,
      window_ms: RATE_LIMIT_WINDOW_MS,
      variation_burst_window_ms: mode === 'variation' ? VARIATION_BURST_WINDOW_MS : undefined,
    });
  } catch (error) {
    console.warn('PostHog rate limit capture failed:', error);
  }
};

const readRateLimitState = (): ClientRateLimitState => {
  try {
    const storedValue = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!storedValue) {
      return { ...DEFAULT_RATE_LIMIT_STATE };
    }

    const parsed = JSON.parse(storedValue) as Partial<ClientRateLimitState>;
    return {
      translate: Array.isArray(parsed.translate) ? parsed.translate : [],
      moreIdeas: Array.isArray(parsed.moreIdeas) ? parsed.moreIdeas : [],
      variation: Array.isArray(parsed.variation) ? parsed.variation : [],
      variationBurst: Array.isArray(parsed.variationBurst) ? parsed.variationBurst : [],
    };
  } catch (error) {
    console.warn('LocalStorage rate limit read failed:', error);
    return { ...DEFAULT_RATE_LIMIT_STATE };
  }
};

const saveRateLimitState = (state: ClientRateLimitState) => {
  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('LocalStorage rate limit save failed:', error);
  }
};

const trimTimestamps = (timestamps: number[], windowMs: number, now: number) => (
  timestamps.filter((timestamp) => now - timestamp < windowMs)
);

const checkRateLimit = (mode: RequestMode, variationKind?: VariationKind): void => {
  try {
    const now = Date.now();
    const state = readRateLimitState();
    const nextState: ClientRateLimitState = {
      translate: trimTimestamps(state.translate, RATE_LIMIT_WINDOW_MS, now),
      moreIdeas: trimTimestamps(state.moreIdeas, RATE_LIMIT_WINDOW_MS, now),
      variation: trimTimestamps(state.variation, RATE_LIMIT_WINDOW_MS, now),
      variationBurst: trimTimestamps(state.variationBurst, VARIATION_BURST_WINDOW_MS, now),
    };

    if (mode === 'variation') {
      if (nextState.variation.length >= VARIATION_MAX_REQUESTS_PER_WINDOW) {
        const waitTimeSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - nextState.variation[0])) / 1000);
        captureRateLimitEvent('client', waitTimeSeconds, mode, variationKind);
        throw new Error(`A lot of versions were tried quickly. Another try will be ready in ${waitTimeSeconds} seconds.`);
      }

      if (nextState.variationBurst.length >= VARIATION_MAX_REQUESTS_PER_BURST) {
        const waitTimeSeconds = Math.ceil((VARIATION_BURST_WINDOW_MS - (now - nextState.variationBurst[0])) / 1000);
        captureRateLimitEvent('client', waitTimeSeconds, mode, variationKind);
        throw new Error(`A lot of versions were tried quickly. Another try will be ready in ${waitTimeSeconds} seconds.`);
      }

      nextState.variation.push(now);
      nextState.variationBurst.push(now);
      saveRateLimitState(nextState);
      return;
    }

    const actionKey = mode === 'moreIdeas' ? 'moreIdeas' : 'translate';
    if (nextState[actionKey].length >= TRANSLATE_MAX_REQUESTS_PER_WINDOW) {
      const waitTimeSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - nextState[actionKey][0])) / 1000);
      captureRateLimitEvent('client', waitTimeSeconds, mode, variationKind);
      throw new Error(`Rate limit reached. Please wait ${waitTimeSeconds} seconds before trying again.`);
    }

    nextState[actionKey].push(now);
    saveRateLimitState(nextState);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('Rate limit reached') ||
      error.message.includes('Another try will be ready')
    )) {
      throw error;
    }
  }
};

const fetchChallengeToken = async (signal?: AbortSignal) => {
  const response = await fetch('/api/challenge', { signal });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed.' }));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const data = await response.json();
  return typeof data.challengeId === 'string' ? data.challengeId : null;
};

const buildRequestBody = (options: TranslateRequestOptions) => {
  if (options.mode === 'variation') {
    return {
      mode: options.mode,
      text: options.imperativeText,
      tone: options.tone,
      interest: options.interest,
      useFewerWords: options.useFewerWords,
      sourceTranslation: options.sourceTranslation,
      variationKind: options.variationKind,
    };
  }

  return {
    mode: options.mode,
    text: options.imperativeText,
    existingTranslations: options.existingTranslations || [],
    tone: options.tone,
    interest: options.interest,
    useFewerWords: options.useFewerWords,
  };
};

export const getDeclarativeTranslations = async (
  options: TranslateRequestOptions
): Promise<Translation[]> => {
  checkRateLimit(options.mode, options.variationKind);

  try {
    const challengeId = await fetchChallengeToken(options.signal);
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Challenge-Id': challengeId || '',
      },
      body: JSON.stringify(buildRequestBody(options)),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed.' }));
      if (response.status === 429) {
        const waitMatch = typeof errorData.error === 'string'
          ? errorData.error.match(/(\d+)\s*seconds/i)
          : null;
        if (waitMatch) {
          captureRateLimitEvent('server', Number(waitMatch[1]), options.mode, options.variationKind);
        }
      }
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const payload = await response.json();
    return ensureTranslations(Array.isArray(payload) ? payload : []);
  } catch (error: unknown) {
    if ((error as { name?: string } | undefined)?.name === 'AbortError') {
      throw error;
    }

    console.error('Translation Error:', error);

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Could not reach the translation service. If you are developing locally, make sure both the web app and API server are running.');
    }

    throw new Error(error instanceof Error ? error.message : 'AI translation unavailable.');
  }
};
