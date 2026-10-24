import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import { buildThinkingConfig, resolveGeminiModelConfig } from './services/geminiConfig.js';
import { createGeminiTranslationHandler } from './services/geminiTranslationHandler.js';
import { createGeminiDemandRadarHandler } from './services/geminiDemandRadarHandler.js';

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

const geminiModelConfig = resolveGeminiModelConfig({
    nodeEnv: process.env.NODE_ENV,
    configId: process.env.GEMINI_MODEL_CONFIG,
});
const geminiThinkingConfig = buildThinkingConfig(geminiModelConfig);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.set('trust proxy', 1); // Trust the single proxy hop (Cloud Run) so clients cannot spoof X-Forwarded-For

// --- Security & Resource Isolation Headers ---
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), accelerometer=(), focus-without-user-activation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "base-uri 'none'; object-src 'none'; frame-ancestors 'self'");
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (req.path.startsWith('/api/') && req.path !== '/api/healthz') {
        res.setHeader('Vary', 'Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site');
        const site = req.get('Sec-Fetch-Site');
        if (site && !['same-origin', 'same-site', 'none'].includes(site)) {
            return res.status(403).json({ error: 'Cross-site API requests are not permitted.' });
        }
    }

    next();
});

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
}, 5 * 60 * 1000).unref();

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

function selectMockVariationPair(templates, sourceTranslation) {
    const normalizedSource = sourceTranslation.trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalizedSource.length; i += 1) {
        hash = (hash * 31 + normalizedSource.charCodeAt(i)) >>> 0;
    }
    const offset = templates.length > 0 ? hash % templates.length : 0;
    const rotated = [
        ...templates.slice(offset),
        ...templates.slice(0, offset),
    ];

    return dedupeVariationTranslations(
        rotated.map((item) => (typeof item === 'string' ? { translation: item } : item)),
        sourceTranslation
    ).slice(0, 2);
}

function buildShorterMockVariationTranslations(sourceTranslation, originalText) {
    const source = sourceTranslation.trim().replace(/[.!?]+$/g, '');
    if (isSafetyRedirectionPrompt(originalText)) {
        return [
            { translation: 'Walking speed inside; running fits outside.' },
            { translation: 'Fast feet have more room outside.' },
            { translation: 'Inside is for walking; outside has running space.' },
            { translation: 'Running speed belongs in the yard.' },
        ];
    }

    if (isCleanupDestinationPrompt(originalText)) {
        const destination = inferCleanupDestination(originalText);
        const items = inferCleanupItems(originalText);
        const sentenceItems = toUpperSentence(items);
        return [
            { translation: `${sentenceItems} head ${destination}.` },
            { translation: `${sentenceItems} have a spot ${destination}.` },
            { translation: `Next up: ${items} ${destination}.` },
            { translation: `Reset time: ${items} go ${destination}.` },
        ];
    }

    if (isDinnerHandwashingPrompt(originalText)) {
        return [
            { translation: 'Downstairs first, then hands and dinner.' },
            { translation: 'Hands at the sink downstairs, then dinner.' },
            { translation: 'Dinner is ready downstairs after hands.' },
            { translation: 'Next up: downstairs, sink, then dinner.' },
        ];
    }

    const taskPhrases = buildTaskPhrases(originalText || source);
    const joinedTasks = joinPhrases(taskPhrases.map(toLowerSentence));
    const upperTasks = toUpperSentence(joinedTasks);

    return [
        { translation: `${upperTasks} comes next.` },
        { translation: `Ready for ${joinedTasks} when you are.` },
        { translation: `Next step: ${joinedTasks}.` },
        { translation: `${upperTasks} is set when timing works.` },
    ];
}

function buildMockVariationTranslations(sourceTranslation, variationKind, originalText = '') {
    const source = sourceTranslation.trim().replace(/[.!?]+$/g, '');
    const lowerSource = toLowerSentence(source);

    if (variationKind === 'shorter') {
        return selectMockVariationPair(
            buildShorterMockVariationTranslations(sourceTranslation, originalText),
            sourceTranslation
        );
    }

    if (isDinnerHandwashingPrompt(originalText)) {
        const dinnerTemplates = {
            similar: [
                'Coming downstairs, washing hands, and then heading to the table is the plan.',
                'First comes heading downstairs for handwashing, and dinner is right after.',
                'The order is downstairs, a quick wash at the sink, and then dinner.',
                'Downstairs is where the sink and dinner are waiting next.',
            ],
            longer: [
                'Everything is set for coming downstairs at your pace, getting hands washed at the sink, and settling in for dinner.',
                'Dinner is waiting downstairs whenever you are ready to head down and give your hands a wash first.',
                'There is plenty of time to head downstairs, stop by the sink for hands, and join the table for dinner.',
                'Whenever this moment wraps up, the next steps are coming downstairs, washing hands, and sitting down to eat.',
            ],
            warmer: [
                'We can take it easy heading downstairs, getting hands washed, and sitting down for dinner together.',
                'Whenever you are ready to come down, the sink is open for hands and a warm dinner is waiting.',
                'No rush on the transition—heading downstairs for hands and dinner can happen at a comfortable pace.',
                'Food is ready downstairs whenever you feel set to come down and rinse your hands first.',
            ],
            more_straightforward: [
                'The sequence is coming downstairs, washing hands, and eating dinner.',
                'Dinner is set downstairs once hands are washed.',
                'Heading downstairs and washing hands are the steps before dinner.',
                'First is coming downstairs to wash hands, and next is dinner.',
            ],
            more_playful: [
                'The dinner quest has three checkpoints: downstairs, a splash at the sink, and food at the table.',
                'Hands get a quick VIP stop at the sink downstairs before dinner takes center stage.',
                'First stop: downstairs sink. Next stop: dinner table.',
                'The sink downstairs is queuing up for a quick hand rinse before dinner begins.',
            ],
        };
        const templates = dinnerTemplates[variationKind] || dinnerTemplates.warmer;
        return selectMockVariationPair(templates, sourceTranslation);
    }

    if (isSafetyRedirectionPrompt(originalText)) {
        const safetyTemplates = {
            similar: [
                'Walking feet fit this room, and running speed has space outside.',
                'The yard is open for fast movement while inside stays at walking pace.',
                'Inside is set up for slower steps, and outside has room to run.',
                'Fast movement works outdoors, while indoor rooms are for walking.',
            ],
            longer: [
                'It looks like your body has a lot of fast energy right now—outside has plenty of open room for running, while inside stays at a walking pace.',
                'There is space outside whenever fast feet need a turn, and the hallway inside works best with slower walking steps.',
                'Running speed fits better outdoors where there is open room, and inside is ready for walking feet.',
                'Whenever fast feet want to go full speed, the yard is open while indoor spaces stay at walking speed.',
            ],
            warmer: [
                'Fast energy is completely okay—let us save the running part for outside where there is room to move freely.',
                'We can keep inside calm with walking feet and take the big running energy outdoors.',
                'Your body has big movement right now, and outside has the space to let those fast feet run.',
                'Let us keep indoor steps gentle and bring the fast running energy out to the yard.',
            ],
            more_straightforward: [
                'Walking pace works inside; running works outside.',
                'Indoor space is for walking, and outdoor space is for running.',
                'This room is set up for walking speed, and the yard is set up for running.',
                'Slow steps fit inside; fast running fits outside.',
            ],
            more_playful: [
                'Turbo mode belongs in the yard while indoor mode stays on cruise control.',
                'Those fast feet have an outdoor ticket; inside is the slow-motion zone.',
                'Zoom speed gets the backyard stage, and walking feet get the house.',
                'Indoor mode is low-gear walking, and outdoor mode is full-speed running.',
            ],
        };
        const templates = safetyTemplates[variationKind] || safetyTemplates.warmer;
        return selectMockVariationPair(templates, sourceTranslation);
    }

    if (isCleanupDestinationPrompt(originalText)) {
        const destination = inferCleanupDestination(originalText);
        const items = inferCleanupItems(originalText);
        const sentenceItems = toUpperSentence(items);
        const cleanupTemplates = {
            similar: [
                `${sentenceItems} are ready to head ${destination} whenever the reset starts.`,
                `The home spot for ${items} is ${destination}.`,
                `Getting ${items} back ${destination} is the next part of the room reset.`,
                `${sentenceItems} can land back ${destination} as part of wrapping up here.`,
            ],
            longer: [
                `Whenever this part wraps up, ${items} have their spot waiting ${destination} so the floor has room again.`,
                `There is no rush on how they get there, and ${items} are ready to land back ${destination}.`,
                `The room reset is ready whenever you are, with ${items} heading back ${destination}.`,
                `Taking ${items} back ${destination} will clear this space whenever the transition feels ready.`,
            ],
            warmer: [
                `We can take our time helping ${items} find their way back ${destination}.`,
                `Whenever you are ready for a reset, ${items} have a cozy spot waiting ${destination}.`,
                `No rush at all—${items} can head back ${destination} at a pace that feels easy.`,
                `We can team up or take it slow getting ${items} settled ${destination}.`,
            ],
            more_straightforward: [
                `The next step is moving ${items} ${destination}.`,
                `${sentenceItems} belong ${destination} when cleanup happens.`,
                `Cleanup here means bringing ${items} ${destination}.`,
                `The spot for ${items} is ${destination}.`,
            ],
            more_playful: [
                `${sentenceItems} are ready for their return trip ${destination}.`,
                `Mission control says ${items} have a landing zone ${destination}.`,
                `Next stop on the map for ${items}: ${destination}.`,
                `${sentenceItems} have a VIP parking spot waiting ${destination}.`,
            ],
        };
        const templates = cleanupTemplates[variationKind] || cleanupTemplates.warmer;
        return selectMockVariationPair(templates, sourceTranslation);
    }

    const taskPhrases = buildTaskPhrases(originalText || source);
    const joinedTasks = joinPhrases(taskPhrases.map(toLowerSentence));
    const upperTasks = toUpperSentence(joinedTasks);

    const variationTemplates = {
        similar: [
            `Right now, ${joinedTasks} is the next part of the plan.`,
            `Everything is set up for ${joinedTasks} when the timing feels right.`,
            `Another way to frame it: ${lowerSource}.`,
            `The next piece on the radar is ${joinedTasks}.`,
        ],
        longer: [
            `There is room to take a breath here—${joinedTasks} is ready whenever it feels manageable to start.`,
            `Looking at the next step, ${lowerSource}, with plenty of space for the transition to unfold calmly.`,
            `Everything needed for ${joinedTasks} is in place, so there is no rush to jump in all at once.`,
            `Whenever this moment wraps up, ${joinedTasks} is waiting with plenty of breathing room.`,
        ],
        warmer: [
            `We can ease into ${joinedTasks} at a gentle pace that feels comfortable.`,
            `Whenever you feel ready, ${joinedTasks} is set up with no rush on the transition.`,
            `There is plenty of softness around this next part—${joinedTasks} can happen when you are set.`,
            `We can take ${joinedTasks} one small step at a time whenever it feels right.`,
        ],
        more_straightforward: [
            `The next step on the list is ${joinedTasks}.`,
            `${upperTasks} is what is coming up next.`,
            `Here is where things stand: ${lowerSource}.`,
            `The plan from here is ${joinedTasks}.`,
        ],
        more_playful: [
            `Up next on the radar: ${joinedTasks}, with a little breathing room built in.`,
            `${upperTasks} is queuing up for its turn whenever the moment is right.`,
            `Plot twist: ${joinedTasks} is ready in the wings when you want it.`,
            `Next checkpoint on the map: ${joinedTasks}.`,
        ],
    };

    const templates = variationTemplates[variationKind] || variationTemplates.warmer;
    return selectMockVariationPair(templates, sourceTranslation);
}

// --- API Endpoint ---
app.post('/api/translate', createGeminiTranslationHandler({
    geminiApiKey,
    geminiModelConfig,
    geminiThinkingConfig,
    redis,
    isMockTranslationMode,
    isDevChallengeBypassEnabled,
    buildMockTranslations,
    buildMockVariationTranslations,
    translateRequestLog,
    variationBurstRequestLog,
    checkRateLimitFn: checkRateLimit,
    logRateLimitHit,
}));

app.post('/api/demand-radar', createGeminiDemandRadarHandler({
    geminiApiKey,
    geminiModelConfig,
    geminiThinkingConfig,
    isMockTranslationMode,
    translateRequestLog,
    checkRateLimitFn: checkRateLimit,
    logRateLimitHit,
}));

app.get('/api/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', configuration: 'ready' });
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
        } else if (localPath.includes('/assets/') || localPath.includes('\\assets\\')) {
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
    console.info(JSON.stringify({
        event: 'gemini_model_config',
        source: 'server',
        config_id: geminiModelConfig.id,
        model: geminiModelConfig.model,
        thinking_config: geminiThinkingConfig,
        pricing_verified_on: geminiModelConfig.pricingVerifiedOn,
    }));
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
