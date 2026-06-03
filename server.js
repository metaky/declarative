import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { buildTranslationPrompt, buildVariationPrompt, systemInstruction } from './services/translationPrompt.js';

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
const TRANSLATIONS_MADE_KEY = 'declarative:stats:translations_made';
const TRANSLATIONS_MADE_SEED = 2011;
const TRANSLATIONS_MADE_TRACKING_STARTED = '2026-05-04';

// --- Server-Side Rate Limiting ---
const CHALLENGE_RATE_LIMIT_WINDOW_MS = 60000;
const TRANSLATE_RATE_LIMIT_WINDOW_MS = 60000;
const VARIATION_BURST_WINDOW_MS = 10000;
const MAX_CHALLENGE_REQUESTS_PER_WINDOW = 30;
const MAX_TRANSLATE_REQUESTS_PER_WINDOW = 10;
const MAX_VARIATION_REQUESTS_PER_WINDOW = 12;
const MAX_VARIATION_REQUESTS_PER_BURST = 3;
const challengeRequestLog = new Map();
const translateRequestLog = new Map();
const variationBurstRequestLog = new Map();

function logRateLimitHit(endpoint, waitSeconds, details = {}) {
    console.warn(JSON.stringify({
        event: 'rate_limit_hit',
        source: 'server',
        endpoint,
        wait_seconds: waitSeconds,
        ...details,
        timestamp: new Date().toISOString(),
    }));
}

function logGeminiUsageMetadata({
    model,
    mode,
    variationKind,
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
            mode,
            variation_kind: variationKind ?? null,
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
        mode,
        variation_kind: variationKind ?? null,
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

async function getTranslationsMadeCount() {
    if (!redis) return null;

    try {
        let count = await redis.get(TRANSLATIONS_MADE_KEY);
        if (count === null || count === undefined) {
            await redis.set(TRANSLATIONS_MADE_KEY, TRANSLATIONS_MADE_SEED, { nx: true });
            count = await redis.get(TRANSLATIONS_MADE_KEY);
        }

        const numericCount = Number(count);
        return Number.isFinite(numericCount) ? numericCount : null;
    } catch (error) {
        console.warn('Translation stats read failed:', error);
        return null;
    }
}

async function incrementTranslationsMadeCount() {
    if (!redis || isDevChallengeBypassEnabled || isMockTranslationMode) return null;

    try {
        await getTranslationsMadeCount();
        return await redis.incr(TRANSLATIONS_MADE_KEY);
    } catch (error) {
        console.warn('Translation stats increment failed:', error);
        return null;
    }
}

function checkRateLimit(log, key, maxRequests, windowMs) {
    const now = Date.now();
    const timestamps = log.get(key) || [];
    const valid = timestamps.filter(t => now - t < windowMs);

    if (valid.length >= maxRequests) {
        const wait = Math.ceil((windowMs - (now - valid[0])) / 1000);
        return { limited: true, wait };
    }

    valid.push(now);
    log.set(key, valid);
    return { limited: false };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of challengeRequestLog.entries()) {
        const valid = timestamps.filter(t => now - t < CHALLENGE_RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) challengeRequestLog.delete(key);
        else challengeRequestLog.set(key, valid);
    }
    for (const [key, timestamps] of translateRequestLog.entries()) {
        const valid = timestamps.filter(t => now - t < TRANSLATE_RATE_LIMIT_WINDOW_MS);
        if (valid.length === 0) translateRequestLog.delete(key);
        else translateRequestLog.set(key, valid);
    }
    for (const [key, timestamps] of variationBurstRequestLog.entries()) {
        const valid = timestamps.filter(t => now - t < VARIATION_BURST_WINDOW_MS);
        if (valid.length === 0) variationBurstRequestLog.delete(key);
        else variationBurstRequestLog.set(key, valid);
    }
}, 5 * 60 * 1000);

// --- API Endpoints ---
app.get('/api/challenge', async (req, res) => {
    const clientIp = req.ip;
    const limit = checkRateLimit(
        challengeRequestLog,
        clientIp,
        MAX_CHALLENGE_REQUESTS_PER_WINDOW,
        CHALLENGE_RATE_LIMIT_WINDOW_MS
    );
    if (limit.limited) {
        logRateLimitHit('/api/challenge', limit.wait, {
            window_ms: CHALLENGE_RATE_LIMIT_WINDOW_MS,
            max_requests_per_window: MAX_CHALLENGE_REQUESTS_PER_WINDOW,
        });
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

app.get('/api/stats', async (req, res) => {
    const translationsMade = await getTranslationsMadeCount();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json({
        translationsMade,
        translationsMadeTrackingStarted: TRANSLATIONS_MADE_TRACKING_STARTED,
    });
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

function toUpperSentence(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
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

function isSafetyRedirectionPrompt(text) {
    const normalized = text.toLowerCase();
    const hasSafetyContext = /\b(stop|don't|dont|no|quit|slow|careful|safe|unsafe|danger|dangerous|hurt|risk)\b/.test(normalized);
    const hasPhysicalRisk = /\b(run|running|fast|speed|climb|jump|throw|hit|stairs|street|road|hot|sharp|unsafe|danger|dangerous)\b/.test(normalized);

    return (hasPhysicalRisk && hasSafetyContext) || /\brunning\s+in\s+the\s+house\b|\bslow\s+down\b/.test(normalized);
}

function isCleanupDestinationPrompt(text) {
    const normalized = text.toLowerCase();
    const hasCleanup = /\b(clean|cleanup|pick up|put\b.*\baway|toys?|blocks?|clothes?|things?)\b/.test(normalized);
    const hasDestination = /\b(upstairs|room|bedroom|closet|shelf|basket|bin|drawer)\b/.test(normalized);

    return hasCleanup && hasDestination;
}

function isDinnerHandwashingPrompt(text) {
    const normalized = text.toLowerCase();
    const hasDinner = /\bdinner\b/.test(normalized);
    const hasHands = /\bwash(?:ing)?\b.*\bhands?\b|\bhands?\b.*\bwash(?:ed|ing)?\b/.test(normalized);
    const hasDownstairs = /\bcome down\b|\bcome downstairs\b|\bdownstairs\b/.test(normalized);

    return hasDinner && hasHands && hasDownstairs;
}

function inferCleanupDestination(text) {
    const normalized = text.toLowerCase();
    if (/\bupstairs\b/.test(normalized) && /\b(room|bedroom)\b/.test(normalized)) return 'upstairs in your room';
    if (/\bupstairs\b/.test(normalized)) return 'upstairs';
    if (/\byour room\b|\bbedroom\b/.test(normalized)) return 'your room';
    if (/\bcloset\b/.test(normalized)) return 'the closet';
    if (/\bshelf\b/.test(normalized)) return 'the shelf';
    if (/\bbasket\b/.test(normalized)) return 'the basket';
    if (/\bbin\b/.test(normalized)) return 'the bin';
    if (/\bdrawer\b/.test(normalized)) return 'the drawer';
    return 'their spot';
}

function inferCleanupItems(text) {
    const normalized = text.toLowerCase();
    if (/\btoys?\b/.test(normalized)) return 'the toys';
    if (/\bblocks?\b/.test(normalized)) return 'the blocks';
    if (/\bclothes?\b/.test(normalized)) return 'the clothes';
    return 'the things';
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

function dedupeVariationTranslations(translations, sourceTranslation) {
    const seen = new Set([sourceTranslation.toLowerCase()]);
    const result = [];

    for (const translation of translations) {
        const normalized = translation.translation.toLowerCase();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(translation);
    }

    return result;
}

function buildSafetyMockTranslations(tone, interest, useFewerWords, existingTranslations) {
    const interestPrefix = tone === 'Interest Based' && interest ? `With ${interest} nearby, ` : '';
    const toneTemplates = {
        Default: [
            'The house has room for walking feet, and running fits better outside.',
            'Fast feet have a safer spot outside.',
            'Inside is a walking-speed space.',
            'Running can wait for a place with more room.',
        ],
        Straightforward: [
            'The house is a walking-speed space.',
            'Running has more room outside.',
            'Fast feet have a better spot outside.',
            'Inside has room for walking feet.',
        ],
        Humorous: [
            'Fast feet have an outdoor job; inside is walking-speed.',
            'The running part belongs where there is more room.',
            'Inside is doing the walking-speed version.',
            'Fast feet can save their big moment for outside.',
        ],
        Equalizing: [
            'You can be the safety checker for which speed fits this room.',
            'I am not sure this room has running-speed space; outside might.',
            'This looks like a walking-speed room, and you know the speed rules best.',
            'Your safety-checker brain might know where fast feet fit better.',
        ],
        'Interest Based': interest ? [
            `${interestPrefix}walking speed inside, running speed outside.`,
            `${interestPrefix}fast feet have more room outside.`,
            `${interestPrefix}inside can be the careful-speed part.`,
            `${interestPrefix}the running part fits better where there is space.`,
        ] : [
            'Inside can be the careful-speed part.',
            'Fast feet have a better spot outside.',
            'The room has space for walking feet.',
            'Running fits better where there is more room.',
        ],
    };

    const selectedTemplates = toneTemplates[tone] || toneTemplates.Default;
    const mocked = selectedTemplates.map(template => ({
        translation: shortenIfNeeded(template, useFewerWords),
    }));

    return dedupeTranslations(mocked, existingTranslations).slice(0, 4);
}

function buildCleanupDestinationMockTranslations(text, tone, interest, useFewerWords, existingTranslations) {
    const destination = inferCleanupDestination(text);
    const items = inferCleanupItems(text);
    const sentenceItems = toUpperSentence(items);

    const toneTemplates = {
        Default: [
            `${sentenceItems} are ready for their spot ${destination}.`,
            `This cleanup includes getting ${items} ${destination}.`,
            `${sentenceItems} have a destination ${destination}.`,
            `The room reset has ${items} heading ${destination}.`,
        ],
        Straightforward: [
            `${sentenceItems} have a spot ${destination}.`,
            `The next part is getting ${items} ${destination}.`,
            `Cleanup means ${items} end up ${destination}.`,
            `${sentenceItems} have a clear spot ${destination}.`,
        ],
        Humorous: [
            `${sentenceItems} have a small trip ${destination}.`,
            `The cleanup part is getting ${items} ${destination}.`,
            `${sentenceItems} are on their way back ${destination}.`,
            `The room reset has ${items} landing ${destination}.`,
        ],
        Equalizing: [
            `You might be the room-reset boss for getting ${items} ${destination}.`,
            `I may need a destination checker for where ${items} go ${destination}.`,
            `Your upstairs route-planner brain might know how ${items} get ${destination}.`,
            `The order expert may know how ${items} end up ${destination}.`,
        ],
        'Interest Based': interest ? [
            `${sentenceItems} can head ${destination} with ${interest} nearby.`,
            `${interest} can stay nearby while ${items} go ${destination}.`,
            `${sentenceItems} can land back ${destination} before ${interest} comes back in.`,
            `The room reset sends ${items} ${destination}, with ${interest} as company.`,
        ] : [
            `${sentenceItems} have a clear destination ${destination}.`,
            `The cleanup part sends ${items} ${destination}.`,
            `${sentenceItems} can land back ${destination}.`,
            `The room reset includes ${items} going ${destination}.`,
        ],
    };

    const selectedTemplates = toneTemplates[tone] || toneTemplates.Default;
    const mocked = selectedTemplates.map(template => ({
        translation: shortenIfNeeded(template, useFewerWords),
    }));

    return dedupeTranslations(mocked, existingTranslations).slice(0, 4);
}

function buildDinnerHandwashingMockTranslations(tone, interest, useFewerWords, existingTranslations) {
    const toneTemplates = {
        Default: [
            'Dinner is downstairs, and hands come before the table.',
            'The next part is coming down, washing hands, then dinner.',
            'Downstairs is the dinner spot, with handwashing first.',
            'I wonder what makes coming down, hands, and dinner feel easier.',
        ],
        Straightforward: [
            'Downstairs, hands, then dinner.',
            'Dinner is downstairs; hands come first.',
            'Handwashing is the step before dinner downstairs.',
            'The table is ready after hands are washed downstairs.',
        ],
        Humorous: [
            'Dinner is doing a tiny drumroll downstairs, and hands get the sink first.',
            'Downstairs dinner made the list; hands have the first stop.',
            'The sink gets a quick cameo before dinner downstairs.',
            'Hands first, then dinner downstairs gets its turn.',
        ],
        Equalizing: [
            'You might be the route expert: downstairs, hands, then dinner.',
            'I may need an order checker for downstairs, hands, and dinner.',
            'Your route brain might know the path to dinner after hands.',
            'The dinner route has downstairs and handwashing; you may know the order.',
        ],
        'Interest Based': interest ? [
            `${interest} can stay nearby while hands get washed before dinner downstairs.`,
            `The dinner route is still downstairs, hands, then food, with ${interest} nearby.`,
            `${interest} can be company for coming down and handwashing before dinner.`,
            `Hands first, then dinner downstairs, with ${interest} waiting nearby.`,
        ] : [
            'The dinner route is downstairs, hands, then food.',
            'Hands can get washed before dinner downstairs, with a little playfulness nearby.',
            'Coming down, hands, and dinner are the next pieces.',
            'The sink comes before dinner downstairs.',
        ],
    };

    const selectedTemplates = toneTemplates[tone] || toneTemplates.Default;
    const mocked = selectedTemplates.map(template => ({
        translation: shortenIfNeeded(template, useFewerWords),
    }));

    return dedupeTranslations(mocked, existingTranslations).slice(0, 4);
}

function buildMockTranslations(text, tone, interest, useFewerWords, existingTranslations = []) {
    if (isSafetyRedirectionPrompt(text)) {
        return buildSafetyMockTranslations(tone, interest, useFewerWords, existingTranslations);
    }

    if (isCleanupDestinationPrompt(text)) {
        return buildCleanupDestinationMockTranslations(text, tone, interest, useFewerWords, existingTranslations);
    }

    if (isDinnerHandwashingPrompt(text)) {
        return buildDinnerHandwashingMockTranslations(tone, interest, useFewerWords, existingTranslations);
    }

    const taskPhrases = buildTaskPhrases(text);
    const joinedTasks = joinPhrases(taskPhrases.map(toLowerSentence));
    const firstTask = toLowerSentence(taskPhrases[0]);
    const secondTask = taskPhrases[1] ? toLowerSentence(taskPhrases[1]) : null;
    const interestSuffix = tone === 'Interest Based' && interest ? ` with ${interest} nearby` : '';

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
            `${joinedTasks} made a tiny cameo in the plan.`,
            `The ${joinedTasks} part is still here, somehow.`,
            `It looks like ${joinedTasks} stayed on the list.`,
            `${joinedTasks} has a small spotlight right now.`,
        ],
        Equalizing: [
            `${joinedTasks} might benefit from an expert eye.`,
            `I may be missing the smarter way through ${joinedTasks}.`,
            `You might have a better read on ${joinedTasks} than I do.`,
            `My plan for ${joinedTasks} might need an order checker.`,
        ],
        'Interest Based': [
            interest
                ? `${interest} can be nearby while ${joinedTasks} happens.`
                : `${joinedTasks} can happen with a little playful energy nearby.`,
            interest
                ? `The ${interest} part can keep ${joinedTasks} company without taking over.`
                : `The next part looks like ${joinedTasks}, with room for a little lightness.`,
            `The next part looks like ${joinedTasks}${interestSuffix}.`,
            `It looks like ${joinedTasks}${interestSuffix} is part of the real plan.`,
        ],
    };

    const selectedTemplates = toneTemplates[tone] || toneTemplates.Default;
    const mocked = selectedTemplates.map(template => ({
        translation: shortenIfNeeded(template, useFewerWords),
    }));

    return dedupeTranslations(mocked, existingTranslations).slice(0, 4);
}

function buildShorterMockVariationTranslations(sourceTranslation, originalText) {
    const source = sourceTranslation.trim().replace(/[.!?]+$/g, '');
    if (isSafetyRedirectionPrompt(originalText)) {
        return [
            { translation: 'Walking speed inside; running fits outside.' },
            { translation: 'Fast feet have more room outside.' },
        ];
    }

    if (isCleanupDestinationPrompt(originalText)) {
        const destination = inferCleanupDestination(originalText);
        const items = inferCleanupItems(originalText);
        const sentenceItems = toUpperSentence(items);
        return [
            { translation: `${sentenceItems} head ${destination}.` },
            { translation: `${sentenceItems} have a spot ${destination}.` },
        ];
    }

    const words = source.split(/\s+/).filter(Boolean);
    const compactLength = Math.max(6, Math.ceil(words.length * 0.7));
    const shorterFragment = words.length <= 8
        ? source
        : words.slice(0, compactLength).join(' ');

    return [
        { translation: `${shorterFragment}.` },
        { translation: words.length <= 8 ? `${source}, simply.` : `${shorterFragment.replace(/,.*$/, '')}.` },
    ];
}

function buildMockVariationTranslations(sourceTranslation, variationKind, originalText = '') {
    const source = sourceTranslation.trim().replace(/[.!?]+$/g, '');

    const variationTemplates = {
        shorter: buildShorterMockVariationTranslations(sourceTranslation, originalText).map(item => item.translation),
        longer: [
            `${source}, and there is room for it to happen in a calm way.`,
            `${source}, with a little more space for the moment to unfold.`,
        ],
        warmer: [
            `${source}, and the moment can stay gentle while it happens.`,
            `${source}, with a little extra softness around the transition.`,
        ],
        more_straightforward: [
            `${source}.`,
            `${source}, and that is the shape of this moment.`,
        ],
        more_playful: [
            `${source}, as if the moment has a light side note attached.`,
            `${source}, with just a touch more lift in the wording.`,
        ],
    };

    const templates = variationTemplates[variationKind] || variationTemplates.warmer;
    return dedupeVariationTranslations(
        templates.map((translation) => ({ translation })),
        sourceTranslation
    ).slice(0, 2);
}

// --- API Endpoint ---
app.post('/api/translate', async (req, res) => {
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
    if (mode === 'variation') {
        const variationLimit = checkRateLimit(
            translateRequestLog,
            `${clientIp}:variation`,
            MAX_VARIATION_REQUESTS_PER_WINDOW,
            TRANSLATE_RATE_LIMIT_WINDOW_MS
        );

        if (variationLimit.limited) {
            logRateLimitHit('/api/translate', variationLimit.wait, {
                mode,
                variation_kind: variationKind,
                window_ms: TRANSLATE_RATE_LIMIT_WINDOW_MS,
                max_requests_per_window: MAX_VARIATION_REQUESTS_PER_WINDOW,
            });
            return res.status(429).json({
                error: `A lot of versions were tried quickly. Another try will be ready in ${variationLimit.wait} seconds.`
            });
        }

        const variationBurstLimit = checkRateLimit(
            variationBurstRequestLog,
            clientIp,
            MAX_VARIATION_REQUESTS_PER_BURST,
            VARIATION_BURST_WINDOW_MS
        );

        if (variationBurstLimit.limited) {
            logRateLimitHit('/api/translate', variationBurstLimit.wait, {
                mode,
                variation_kind: variationKind,
                window_ms: VARIATION_BURST_WINDOW_MS,
                max_requests_per_window: MAX_VARIATION_REQUESTS_PER_BURST,
            });
            return res.status(429).json({
                error: `A lot of versions were tried quickly. Another try will be ready in ${variationBurstLimit.wait} seconds.`
            });
        }
    } else {
        const limit = checkRateLimit(
            translateRequestLog,
            `${clientIp}:translate`,
            MAX_TRANSLATE_REQUESTS_PER_WINDOW,
            TRANSLATE_RATE_LIMIT_WINDOW_MS
        );
        if (limit.limited) {
            logRateLimitHit('/api/translate', limit.wait, {
                mode,
                window_ms: TRANSLATE_RATE_LIMIT_WINDOW_MS,
                max_requests_per_window: MAX_TRANSLATE_REQUESTS_PER_WINDOW,
            });
            return res.status(429).json({
                error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.`
            });
        }
    }

    const apiKey = geminiApiKey;
    if (isMockTranslationMode) {
        if (mode === 'variation') {
            return res.json(buildMockVariationTranslations(sourceTranslation.translation, variationKind, text));
        }

        return res.json(buildMockTranslations(text, tone, normalizedInterest, useFewerWords, existingTranslations));
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server.' });
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
        const normalizedTranslations = mode === 'variation'
            ? dedupeVariationTranslations(translations, sourceTranslation.translation).slice(0, 2)
            : translations;
        logGeminiUsageMetadata({
            model: 'gemini-2.5-flash',
            mode,
            variationKind,
            tone,
            useFewerWords,
            existingTranslationsCount: existingTranslations.length,
            textLength: text.length,
            durationMs: Date.now() - requestStartedAt,
            usageMetadata: response.usageMetadata,
        });
        if (mode === 'translate') {
            await incrementTranslationsMadeCount();
        }
        return res.json(normalizedTranslations);
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
