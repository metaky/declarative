import { GoogleGenAI, Type } from '@google/genai';
import {
  classifyGeminiFailure,
  isGeminiResponseBlocked,
  raceGeminiRequestWithTimeout,
  validateGeminiResponse,
} from './geminiResponse.js';
import { getGeminiFinishReason, logGeminiCompletionEvent } from './geminiObservability.js';
import { buildTranslationPrompt, buildVariationPrompt, systemInstruction } from './translationPrompt.js';

const TRANSLATE_RATE_LIMIT_WINDOW_MS = 60_000;
const VARIATION_BURST_WINDOW_MS = 10_000;
const MAX_TRANSLATE_REQUESTS_PER_WINDOW = 10;
const MAX_VARIATION_REQUESTS_PER_WINDOW = 12;
const MAX_VARIATION_REQUESTS_PER_BURST = 3;

function checkRateLimit(log, key, maxRequests, windowMs) {
  const now = Date.now();
  const timestamps = log.get(key) || [];
  const valid = timestamps.filter((timestamp) => now - timestamp < windowMs);

  if (valid.length >= maxRequests) {
    return { limited: true, wait: Math.ceil((windowMs - (now - valid[0])) / 1000) };
  }

  valid.push(now);
  log.set(key, valid);
  return { limited: false };
}

function noOpRateLimitLog() {}

export function createGeminiTranslationHandler({
  geminiApiKey,
  geminiModelConfig,
  geminiThinkingConfig,
  redis = null,
  isMockTranslationMode = false,
  isDevChallengeBypassEnabled = false,
  buildMockTranslations,
  buildMockVariationTranslations,
  createGeminiClient = (apiKey) => new GoogleGenAI({ apiKey }),
  completionLogger = logGeminiCompletionEvent,
  revision = process.env.K_REVISION,
  translateRequestLog = new Map(),
  variationBurstRequestLog = new Map(),
  checkRateLimitFn = checkRateLimit,
  logRateLimitHit = noOpRateLimitLog,
  timeoutMs = 30_000,
  now = () => Date.now(),
} = {}) {
  function emitCompletion(details) {
    try {
      void Promise.resolve(completionLogger(details)).catch(() => {});
    } catch {
      // The request result must not depend on whether telemetry is available.
    }
  }

  return async (req, res) => {
    const {
      mode = 'translate',
      text,
      existingTranslations = [],
      tone,
      interest,
      useFewerWords,
      sourceTranslation,
      variationKind,
    } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "text" field.' });
    }

    if (text.length > 500) {
      return res.status(400).json({ error: 'Input text exceeds the maximum limit of 500 characters.' });
    }

    if (!['translate', 'moreIdeas', 'variation'].includes(mode)) {
      return res.status(400).json({ error: 'Missing or invalid "mode" field.' });
    }

    const normalizedInterest = typeof interest === 'string' ? interest.trim() : '';
    if (tone === 'Interest Based' && !normalizedInterest) {
      return res.status(400).json({ error: 'Interest Based ideas need an entered interest.' });
    }

    if (mode === 'variation') {
      if (!sourceTranslation || typeof sourceTranslation.translation !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid source translation.' });
      }
      if (!['shorter', 'longer', 'warmer', 'more_straightforward', 'more_playful'].includes(variationKind)) {
        return res.status(400).json({ error: 'Missing or invalid variation kind.' });
      }
    }

    if (!isDevChallengeBypassEnabled) {
      const challengeId = req.headers['x-challenge-id'];
      if (!challengeId || !redis) {
        console.warn('Request missing challenge ID or Redis not configured');
        return res.status(403).json({ error: 'Access denied. Please use the official website.' });
      }

      try {
        const challengeKey = `declarative:challenge:${challengeId}`;
        const isValid = await redis.exists(challengeKey);
        if (!isValid) {
          console.warn(`Invalid or expired challenge ID: ${challengeId}`);
          return res.status(403).json({ error: 'Invalid or expired session. Please refresh the page.' });
        }
        await redis.del(challengeKey);
      } catch (error) {
        console.error('Challenge verification failed:', error);
        return res.status(403).json({ error: 'Security verification failed.' });
      }
    }

    const clientIp = req.ip;
    if (mode === 'variation') {
      const variationLimit = checkRateLimitFn(
        translateRequestLog,
        `${clientIp}:variation`,
        MAX_VARIATION_REQUESTS_PER_WINDOW,
        TRANSLATE_RATE_LIMIT_WINDOW_MS,
      );
      if (variationLimit.limited) {
        logRateLimitHit('/api/translate', variationLimit.wait, {
          mode,
          variation_kind: variationKind,
          window_ms: TRANSLATE_RATE_LIMIT_WINDOW_MS,
          max_requests_per_window: MAX_VARIATION_REQUESTS_PER_WINDOW,
        });
        return res.status(429).json({ error: `A lot of versions were tried quickly. Another try will be ready in ${variationLimit.wait} seconds.` });
      }

      const variationBurstLimit = checkRateLimitFn(
        variationBurstRequestLog,
        clientIp,
        MAX_VARIATION_REQUESTS_PER_BURST,
        VARIATION_BURST_WINDOW_MS,
      );
      if (variationBurstLimit.limited) {
        logRateLimitHit('/api/translate', variationBurstLimit.wait, {
          mode,
          variation_kind: variationKind,
          window_ms: VARIATION_BURST_WINDOW_MS,
          max_requests_per_window: MAX_VARIATION_REQUESTS_PER_BURST,
        });
        return res.status(429).json({ error: `A lot of versions were tried quickly. Another try will be ready in ${variationBurstLimit.wait} seconds.` });
      }
    } else {
      const limit = checkRateLimitFn(
        translateRequestLog,
        `${clientIp}:translate`,
        MAX_TRANSLATE_REQUESTS_PER_WINDOW,
        TRANSLATE_RATE_LIMIT_WINDOW_MS,
      );
      if (limit.limited) {
        logRateLimitHit('/api/translate', limit.wait, {
          mode,
          window_ms: TRANSLATE_RATE_LIMIT_WINDOW_MS,
          max_requests_per_window: MAX_TRANSLATE_REQUESTS_PER_WINDOW,
        });
        return res.status(429).json({ error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.` });
      }
    }

    if (isMockTranslationMode) {
      if (mode === 'variation') {
        return res.json(buildMockVariationTranslations(sourceTranslation.translation, variationKind, text));
      }
      return res.json(buildMockTranslations(text, tone, normalizedInterest, useFewerWords, existingTranslations));
    }

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'AI translation unavailable.' });
    }

    const basePrompt = mode === 'variation'
      ? buildVariationPrompt({
        text,
        sourceTranslation: sourceTranslation.translation,
        variationKind,
        tone,
        interest: normalizedInterest,
        useFewerWords,
      })
      : buildTranslationPrompt({
        text,
        existingTranslations,
        tone,
        interest: normalizedInterest,
        useFewerWords,
      });

    let requestStartedAt = null;
    try {
      const ai = createGeminiClient(geminiApiKey);
      requestStartedAt = now();
      const response = await raceGeminiRequestWithTimeout(ai.models.generateContent({
        model: geminiModelConfig.model,
        contents: basePrompt,
        config: {
          thinkingConfig: geminiThinkingConfig,
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { translation: { type: Type.STRING } },
              required: ['translation'],
            },
          },
        },
      }), { timeoutMs });
      const durationMs = now() - requestStartedAt;
      const finishReason = getGeminiFinishReason(response);
      const blocked = isGeminiResponseBlocked(response);
      const validation = validateGeminiResponse({
        responseText: blocked ? '' : response.text,
        mode,
        existingTranslations,
        sourceTranslation,
        blocked,
      });
      if (!validation.ok) {
        emitCompletion({
          outcome: validation.code,
          revision,
          config: geminiModelConfig,
          mode,
          variationKind,
          durationMs,
          usageMetadata: response.usageMetadata,
          suggestionCount: 0,
          finishReason,
        });
        return res.status(500).json({ error: 'AI translation unavailable.' });
      }

      emitCompletion({
        outcome: validation.code,
        revision,
        config: geminiModelConfig,
        mode,
        variationKind,
        durationMs,
        usageMetadata: response.usageMetadata,
        suggestionCount: validation.suggestions.length,
        finishReason,
      });
      return res.json(validation.suggestions);
    } catch (error) {
      if (requestStartedAt !== null) {
        emitCompletion({
          outcome: classifyGeminiFailure(error),
          revision,
          config: geminiModelConfig,
          mode,
          variationKind,
          durationMs: now() - requestStartedAt,
          suggestionCount: 0,
        });
      }
      return res.status(500).json({ error: 'AI translation unavailable.' });
    }
  };
}
