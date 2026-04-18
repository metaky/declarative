import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { buildTranslationPrompt, systemInstruction } from './services/translationPrompt.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local if present (for local development)
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && !process.env[key]) {
                process.env[key] = valueParts.join('=');
            }
        }
    }
}

const app = express();
app.use(express.json());
app.set('trust proxy', true); // Trust the proxy (Cloud Run) to accurately determine req.ip

// Initialize Redis for challenge storage
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
const geminiApiKey = process.env.GEMINI_API_KEY?.replace(/^"|"$/g, '')?.replace(/^'|'$/g, '');
const redis = redisUrl && redisToken ? new Redis({
    url: redisUrl,
    token: redisToken,
}) : null;
const isMockTranslationMode = process.env.NODE_ENV !== 'production' && process.env.DEV_USE_MOCK_TRANSLATIONS === 'true';
const isDevChallengeBypassEnabled = process.env.NODE_ENV !== 'production' && process.env.DEV_BYPASS_CHALLENGE === 'true';

// --- Server-Side Rate Limiting ---
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog = new Map();

function logRateLimitHit(endpoint, waitSeconds) {
    console.warn(JSON.stringify({
        event: 'rate_limit_hit',
        source: 'server',
        endpoint,
        wait_seconds: waitSeconds,
        window_ms: RATE_LIMIT_WINDOW_MS,
        max_requests_per_window: MAX_REQUESTS_PER_WINDOW,
        timestamp: new Date().toISOString(),
    }));
}

function logGeminiUsageMetadata({
    model,
    tone,
    useFewerWords,
    existingTranslationsCount,
    textLength,
    durationMs,
    usageMetadata,
}) {
    if (!usageMetadata) {
        console.info(JSON.stringify({
            event: 'gemini_usage_metadata',
            source: 'server',
            model,
            tone: tone || 'Default',
            use_fewer_words: Boolean(useFewerWords),
            existing_translations_count: existingTranslationsCount,
            text_length: textLength,
            duration_ms: durationMs,
            usage_metadata_available: false,
            timestamp: new Date().toISOString(),
        }));
        return;
    }

    console.info(JSON.stringify({
        event: 'gemini_usage_metadata',
        source: 'server',
        model,
        tone: tone || 'Default',
        use_fewer_words: Boolean(useFewerWords),
        existing_translations_count: existingTranslationsCount,
        text_length: textLength,
        duration_ms: durationMs,
        usage_metadata_available: true,
        prompt_token_count: usageMetadata.promptTokenCount ?? null,
        candidates_token_count: usageMetadata.candidatesTokenCount ?? null,
        thoughts_token_count: usageMetadata.thoughtsTokenCount ?? null,
        total_token_count: usageMetadata.totalTokenCount ?? null,
        cached_content_token_count: usageMetadata.cachedContentTokenCount ?? null,
        cache_tokens_details: usageMetadata.cacheTokensDetails ?? null,
        prompt_tokens_details: usageMetadata.promptTokensDetails ?? null,
        candidates_tokens_details: usageMetadata.candidatesTokensDetails ?? null,
        timestamp: new Date().toISOString(),
    }));
}

function checkRateLimit(ip) {
    const now = Date.now();
    const timestamps = requestLog.get(ip) || [];
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (valid.length >= MAX_REQUESTS_PER_WINDOW) {
        const wait = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - valid[0])) / 1000);
        return { limited: true, wait };
    }

    valid.push(now);
    requestLog.set(ip, valid);
    return { limited: false };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of requestLog.entries()) {
        const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) {
            requestLog.delete(ip);
        } else {
            requestLog.set(ip, valid);
        }
    }
}, 5 * 60 * 1000);

// --- API Endpoints ---
app.get('/api/challenge', async (req, res) => {
    const clientIp = req.ip;
    const limit = checkRateLimit(clientIp);
    if (limit.limited) {
        logRateLimitHit('/api/challenge', limit.wait);
        return res.status(429).json({
            error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.`
        });
    }

    if (isDevChallengeBypassEnabled) {
        return res.json({ challengeBypassed: true });
    }

    try {
        if (!redis) {
            console.warn("Redis not configured for /api/challenge");
            return res.status(503).json({ error: "Service unavailable" });
        }

        const challengeId = uuidv4();

        // Store the challenge ID in Redis with a 15-minute TTL
        // Every hit to this endpoint creates a one-time-use token for a human session
        await redis.set(`declarative:challenge:${challengeId}`, "valid", { ex: 900 });

        return res.json({ challengeId });
    } catch (error) {
        console.error("Failed to generate challenge token:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
});

function normalizeText(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/g, '');
}

function toLowerSentence(text) {
    if (!text) return '';
    return text.charAt(0).toLowerCase() + text.slice(1);
}

function buildTaskPhrases(text) {
    const normalized = normalizeText(text);
    const parts = normalized
        .split(/\s+(?:and|then)\s+/i)
        .map(part => part.trim())
        .filter(Boolean);

    if (parts.length === 0) {
        return ['this'];
    }

    return parts.map(part => {
        const softened = part
            .replace(/^(please\s+)?/i, '')
            .replace(/^(sit down|stand up|put on|get|go|come|stop|start|do|finish|clean|pick up|focus on|work on|brush|wash|grab|take|leave|head to|turn off|turn on)\b\s*/i, '')
            .trim();

        return softened || part;
    });
}

function joinPhrases(phrases) {
    if (phrases.length === 1) return phrases[0];
    if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
    return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

function shortenIfNeeded(text, useFewerWords) {
    if (!useFewerWords) return text;

    return text
        .replace(/^I (notice|wonder|guess|see|am thinking|am noticing) /, '')
        .replace(/^It looks like /, '')
        .replace(/^Maybe /, '')
        .replace(/^Should we /, 'Should we ')
        .replace(/^Do we want to /, 'Want to ')
        .replace(/^Would it help to /, 'Help to ')
        .trim();
}

function dedupeTranslations(translations, existingTranslations = []) {
    const seen = new Set(existingTranslations.map(item => item.translation.toLowerCase()));
    const result = [];

    for (const translation of translations) {
        const normalized = translation.translation.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(translation);
    }

    return result;
}

function buildMockTranslations(text, tone, interest, useFewerWords, existingTranslations = []) {
    const taskPhrases = buildTaskPhrases(text);
    const joinedTasks = joinPhrases(taskPhrases.map(toLowerSentence));
    const firstTask = toLowerSentence(taskPhrases[0]);
    const secondTask = taskPhrases[1] ? toLowerSentence(taskPhrases[1]) : null;
    const interestSuffix = tone === 'Interest Based' && interest ? ` for ${interest}` : '';

    const toneTemplates = {
        Default: [
            `${taskPhrases[0]} is part of what's happening${interestSuffix}.`,
            `It looks like ${joinedTasks}${interestSuffix} is part of the plan.`,
            `The situation includes ${joinedTasks}${interestSuffix}.`,
            `I wonder what would make ${joinedTasks}${interestSuffix} feel easier.`,
        ],
        Straightforward: [
            `${taskPhrases[0]} is what's next.`,
            secondTask
                ? `${firstTask} and ${secondTask} are both part of this moment.`
                : `${firstTask} is part of this moment.`,
            secondTask
                ? `Everything for ${firstTask} and ${secondTask} is ready when it works.`
                : `Everything for ${firstTask} is ready when it works.`,
            secondTask
                ? `It came up quickly. ${firstTask} and ${secondTask} are both set up.`
                : `It came up quickly. ${taskPhrases[0]} is ready when you want it.`,
        ],
        Humorous: [
            `${joinedTasks} appears to be back for an encore.`,
            `Uh oh, ${joinedTasks} made it into today's plot line.`,
            `It looks like ${joinedTasks} did not magically disappear.`,
            `${joinedTasks} may be the sneaky side quest today.`,
        ],
        Equalizing: [
            `${joinedTasks} might benefit from an expert eye.`,
            `There may be a smarter way through ${joinedTasks}.`,
            `You might have a better read on ${joinedTasks} than this setup does.`,
            `I wonder what an expert would notice about ${joinedTasks}.`,
        ],
        'Interest Based': [
            `${taskPhrases[0]}${interestSuffix} is part of what's happening.`,
            `I wonder how ${joinedTasks}${interestSuffix} would go today.`,
            `The next part looks like ${joinedTasks}${interestSuffix}.`,
            `It looks like ${joinedTasks}${interestSuffix} is on the map.`,
        ],
    };

    const selectedTemplates = toneTemplates[tone] || toneTemplates.Default;
    const mocked = selectedTemplates.map(template => ({
        translation: shortenIfNeeded(template, useFewerWords),
    }));

    return dedupeTranslations(mocked, existingTranslations).slice(0, 4);
}

// --- API Endpoint ---
app.post('/api/translate', async (req, res) => {
    const { text, existingTranslations = [], tone, interest, useFewerWords } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "text" field.' });
    }

    if (text.length > 500) {
        return res.status(400).json({ error: 'Input text exceeds the maximum limit of 500 characters.' });
    }

    // 1. Challenge Token Verification (Primary Bot Defense)
    if (!isDevChallengeBypassEnabled) {
        const challengeId = req.headers['x-challenge-id'];

        if (!challengeId || !redis) {
            console.warn("Request missing challenge ID or Redis not configured");
            return res.status(403).json({ error: "Access denied. Please use the official website." });
        }

        try {
            const challengeKey = `declarative:challenge:${challengeId}`;
            const isValid = await redis.exists(challengeKey);

            if (!isValid) {
                console.warn(`Invalid or expired challenge ID: ${challengeId}`);
                return res.status(403).json({ error: "Invalid or expired session. Please refresh the page." });
            }

            // Single-use: Delete the token immediately after verification
            await redis.del(challengeKey);
        } catch (err) {
            console.error("Challenge verification failed:", err);
            // Fail closed for security - strictly require challenge token
            return res.status(403).json({ error: "Security verification failed." });
        }
    }

    // req.ip works reliably here because 'trust proxy' is set to true
    const clientIp = req.ip;
    const limit = checkRateLimit(clientIp);
    if (limit.limited) {
        logRateLimitHit('/api/translate', limit.wait);
        return res.status(429).json({
            error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.`
        });
    }

    const apiKey = geminiApiKey;
    if (isMockTranslationMode) {
        return res.json(buildMockTranslations(text, tone, interest, useFewerWords, existingTranslations));
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const basePrompt = buildTranslationPrompt({
        text,
        existingTranslations,
        tone,
        interest,
        useFewerWords,
    });

    try {
        const ai = new GoogleGenAI({ apiKey });
        const requestStartedAt = Date.now();

        // Race the API call against a 30-second timeout
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out. The AI service took too long to respond.')), 30000)
        );

        const apiPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: basePrompt,
            config: {
                thinkingConfig: {
                    thinkingBudget: 0,
                },
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            translation: { type: Type.STRING },
                        },
                        required: ['translation'],
                    },
                },
            },
        });

        const response = await Promise.race([apiPromise, timeoutPromise]);
        const responseText = response.text;
        if (!responseText) {
            return res.status(500).json({ error: 'Empty response from AI.' });
        }

        const translations = JSON.parse(responseText.trim());
        logGeminiUsageMetadata({
            model: 'gemini-2.5-flash',
            tone,
            useFewerWords,
            existingTranslationsCount: existingTranslations.length,
            textLength: text.length,
            durationMs: Date.now() - requestStartedAt,
            usageMetadata: response.usageMetadata,
        });
        return res.json(translations);
    } catch (error) {
        console.error('Gemini API Error:', error);
        const message = error instanceof Error ? error.message : 'AI translation unavailable.';
        if (message.includes('API key not valid')) {
            return res.status(500).json({ error: 'API Key is not valid. Please check server configuration.' });
        }
        return res.status(500).json({ error: message });
    }
});

// --- Static File Serving ---
// ============================================================================
// CRITICAL: SPA CACHING RULES - DO NOT REMOVE OR MODIFY THESE CACHE HEADERS
// ============================================================================
// The live site experiences a "blank white screen" error after deployments if 
// index.html is allowed to be cached by browsers. Ensure index.html ALWAYS gets 
// `no-cache`, while the hashed bundles in `/assets/` get aggressively cached.
// ============================================================================
app.use(express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, localPath) => {
        if (localPath.endsWith('index.html')) {
            // Never cache index.html
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (localPath.includes('/assets/')) {
            // Aggressively cache hashed bundles for 1 year
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// SPA fallback — serve index.html for any non-API, non-static route
app.get('{*path}', (req, res) => {
    // Prevent sending index.html for missing file assets (.js, .css, etc)
    if (req.path.includes('.')) {
        return res.status(404).send('Not Found');
    }
    
    // Also explicitly set no-cache for the SPA fallback
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    if (isDevChallengeBypassEnabled) {
        console.warn('⚠️  DEV_BYPASS_CHALLENGE=true - local dev requests can call /api/translate without challenge verification.');
    }
    if (isMockTranslationMode) {
        console.warn('⚠️  DEV_USE_MOCK_TRANSLATIONS=true - returning local mock translations instead of calling Gemini.');
    }
    if (!geminiApiKey || geminiApiKey === 'PLACEHOLDER_API_KEY') {
        console.warn('⚠️  WARNING: GEMINI_API_KEY is not set or is a placeholder. Translations will fail.');
        console.warn('   Set it in .env.local or as an environment variable.');
    }
});
