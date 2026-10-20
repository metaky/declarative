import { GoogleGenAI, Type } from '@google/genai';
import { raceGeminiRequestWithTimeout } from './geminiResponse.js';

const VALID_CATEGORIES = new Set([
  'imperative',
  'urgency',
  'absolute',
  'threat',
  'negative',
  'rhetorical',
]);

const DEMAND_RADAR_SYSTEM_INSTRUCTION = `You are "Demand Radar," a PDA-aware (Pathological Demand Avoidance) linguistic coach for caregivers.
Analyze the caregiver's statement and identify specific exact substrings (words or phrases) that carry demand pressure for a PDA nervous system.

Categories (must be one of these exact strings):
- "imperative": Direct commands ("put your shoes on", "be quiet", "calm down"), obligation frames ("I need you to...", "I want you to...", "you have to...", "we need to...", "it's time to..."), or chained action demands.
- "urgency": Time pressure or abrupt transition announcements ("now", "right now", "hurry", "it's bedtime", "we're late").
- "absolute": All-or-nothing framing ("always", "never", "every time").
- "threat": Ultimatums, countdowns, or conditional contingencies/rewards ("or else", "if you don't", "first X then Y", "no iPad until...").
- "negative": Negative commands ("stop", "don't", "no running", "no more...") or behavioral criticisms/guilt/comparisons ("you're being too loud", "your sister is already ready", "it makes me sad when...").
- "rhetorical": Shaming or disguised compliance questions ("How many times do I have to...", "Why can't you just...", "Can you be quiet?", "Are you going to eat?").

Rules:
1. Every "phrase" MUST be an exact, verbatim substring from the input text.
2. If the statement is genuinely low-pressure and declarative (e.g. "Toothbrushes are waiting on the sink" or "Could you please put your shoes on when you're ready?"), return an empty array [].
3. Keep "note" to 1-2 warm, non-judgmental sentences explaining why this phrase triggers a PDA nervous system's threat response. Never shame the parent.`;

export function createGeminiDemandRadarHandler({
  geminiApiKey,
  geminiModelConfig,
  geminiThinkingConfig,
  isMockTranslationMode = false,
  translateRequestLog = new Map(),
  checkRateLimitFn = null,
  createGeminiClient = (apiKey) => new GoogleGenAI({ apiKey }),
  timeoutMs = 12_000,
} = {}) {
  return async (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string' || text.length > 500) {
      return res.status(400).json({ error: 'Invalid text.' });
    }

    if (typeof checkRateLimitFn === 'function') {
      const limit = checkRateLimitFn(
        translateRequestLog,
        `${req.ip}:demand-radar`,
        15,
        60_000
      );
      if (limit.limited) {
        return res.status(429).json({ signals: [] });
      }
    }

    if (isMockTranslationMode || !geminiApiKey || geminiApiKey === 'PLACEHOLDER_API_KEY') {
      return res.json({ signals: [] });
    }

    try {
      const ai = createGeminiClient(geminiApiKey);
      const response = await raceGeminiRequestWithTimeout(
        ai.models.generateContent({
          model: geminiModelConfig.model,
          contents: `Analyze demand signals in: "${text}"`,
          config: {
            ...(geminiThinkingConfig ? { thinkingConfig: geminiThinkingConfig } : {}),
            systemInstruction: DEMAND_RADAR_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phrase: { type: Type.STRING },
                  category: { type: Type.STRING },
                  severity: { type: Type.STRING },
                  note: { type: Type.STRING },
                },
                required: ['phrase', 'category', 'severity', 'note'],
              },
            },
          },
        }),
        { timeoutMs }
      );

      const rawText = typeof response?.text === 'string' ? response.text.trim() : '[]';
      const parsed = JSON.parse(rawText);
      if (!Array.isArray(parsed)) {
        return res.json({ signals: [] });
      }

      const signals = [];
      const lowerInput = text.toLowerCase();

      for (const item of parsed) {
        if (!item || typeof item.phrase !== 'string' || !item.phrase.trim()) continue;
        const phrase = item.phrase.trim();
        const idx = lowerInput.indexOf(phrase.toLowerCase());
        if (idx === -1) continue;

        const category = VALID_CATEGORIES.has(item.category) ? item.category : 'imperative';
        const severity = item.severity === 'mild' ? 'mild' : 'strong';
        const exactPhrase = text.slice(idx, idx + phrase.length);

        signals.push({
          id: `ai:${category}:${exactPhrase.toLowerCase()}:${idx}`,
          start: idx,
          end: idx + exactPhrase.length,
          phrase: exactPhrase,
          category,
          severity,
          note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : '',
        });
      }

      return res.json({ signals });
    } catch {
      // Fail gracefully so client-side syntactic signals still display without interruption
      return res.json({ signals: [] });
    }
  };
}
