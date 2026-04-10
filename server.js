import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';

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

// --- System Prompt ---
const systemInstruction = `You are an AI assistant named "Declarative," designed as a co-regulation tool for parents and caregivers of children with a Pathological Demand Avoidance (PDA) profile. Your primary goal is to help users rephrase their imperative commands (demands) into gentle, connecting, and non-demanding declarative language.

Your core principles are:
1.  **Connection, Not Compliance:** Success is measured by building trust and "felt safety," not by achieving task completion.
2.  **Calm by Design:** Your tone must be gentle, supportive, and understanding.
3.  **Authenticity First:** Actively warn against manipulative phrasing. Your suggestions must be authentic invitations, not passive-aggressive commands. Prioritize the "Give Over Get" mindset.
4.  **Empathy-Driven AI:** Always offer options, not directives. Root suggestions in autonomy and respect.

When a user provides a statement, you must:
1.  **Address the Whole Statement:** CRITICAL: If the user provides a statement with multiple distinct parts or tasks (e.g., "Wash your hands and sit at the table"), ensure your declarative suggestions gracefully address ALL parts of the request. Do not omit details; instead, weave them together into a coherent, non-demanding narrative that acknowledges the full context.
2.  **Recognize Intent:** Understand the underlying goal and context.
3.  **Remove Demands:** Eliminate direct commands and obligation words ("need to," "must," "please do X").
4.  **Reframe Declaratively:** Generate 3-4 varied alternatives (Observation, Self-Narrate, Invitation, Problem-Solving).
5.  **Filter for Authenticity:** Discard any phrasing that sounds manipulative or like a "test."

Your output must be a valid JSON array of objects.`;

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
            `I notice ${joinedTasks}${interestSuffix}.`,
            `I am thinking about ${joinedTasks}${interestSuffix}.`,
            `Maybe we could figure out ${joinedTasks}${interestSuffix}.`,
            `I wonder what would make ${joinedTasks}${interestSuffix} feel easier.`,
        ],
        Straightforward: [
            `I notice ${joinedTasks}.`,
            secondTask
                ? `I am getting ready for ${firstTask} and ${secondTask}.`
                : `I am getting ready for ${firstTask}.`,
            secondTask
                ? `I set things up for ${firstTask} and ${secondTask} if you are ready.`
                : `I set things up for ${firstTask} if you are ready.`,
            secondTask
                ? `It came up quickly. Everything for ${firstTask} and ${secondTask} is ready when you want it.`
                : `It came up quickly. ${taskPhrases[0]} is ready when you want it.`,
        ],
        Humorous: [
            `I think ${joinedTasks} may be staging a comeback tour.`,
            `Uh oh, ${joinedTasks} is back on today's plot line.`,
            `It looks like ${joinedTasks} did not magically disappear.`,
            `I am wondering whether ${joinedTasks} is the sneaky side quest today.`,
        ],
        Equalizing: [
            `I may need your help with ${joinedTasks}.`,
            `You probably know a better way to handle ${joinedTasks} than I do.`,
            `I think you are more qualified than me for ${joinedTasks}.`,
            `I could use your expert opinion on ${joinedTasks}.`,
        ],
        'Interest Based': [
            `I notice ${joinedTasks}${interestSuffix}.`,
            `I wonder how ${joinedTasks}${interestSuffix} would go today.`,
            `Maybe we could try ${joinedTasks}${interestSuffix}.`,
            `It looks like ${joinedTasks}${interestSuffix} is the next part.`,
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

    // Build tone instruction
    let toneInstruction = 'Please use a neutral, warm, and observational tone that focuses on sharing information.';
    if (tone && tone !== 'Default') {
        switch (tone) {
            case 'Straightforward':
                toneInstruction = `Please use a "Straightforward" tone. Keep suggestions calm, plainspoken, and to the point with a low emotional temperature, but make them clearly recognisable as declarative language. Prioritize observation-first phrasing, simple self-narration, low-pressure statements of what is happening, and gentle availability cues over questions or prompts. Across the 3-4 suggestions, include a mix: 1-2 concise options and at least 1 slightly fuller option that still sounds natural and low-pressure. Use simple everyday wording and keep the suggestions meaningfully varied so they do not all sound like short label statements. Preserve felt safety and connection: the goal is to share information, reduce demand, and leave room for autonomy, not to push for compliance. Avoid jokes, hype, slang, roleplay, exaggerated metaphors, faux-choice pressure, obligation words, praise used as pressure, urgency, and any disguised command. Avoid sounding clipped, bossy, manipulative, or like you are testing the child.`;
                break;
            case 'Interest Based':
                toneInstruction = interest
                    ? `Please incorporate the theme of "${interest}" in a fun and engaging way. Use specific terminology or concepts related to it.`
                    : `Please use a fun, engaging, and high-energy tone.`;
                break;
            case 'Equalizing':
                toneInstruction = `Please use an "Equalizing" tone. Frame the statement as if the child is the expert/leader, or playfully position the adult as needing correction, help, or being "silly" and forgetful.`;
                break;
            case 'Humorous':
                toneInstruction = `Please use a "Humorous" and playful tone to lower defenses. Use lighthearted jokes or "absurd" observations to break the demand cycle.`;
                break;
        }
    }

    const lengthInstruction = useFewerWords ? ' CRITICAL: Keep all suggestions extremely short (under 7 words if possible).' : '';
    const existingList = existingTranslations.length > 0
        ? `\nAvoid repeating these specific ideas: ${existingTranslations.map(t => t.translation).join(', ')}`
        : '';

    const prompt = `Convert the ENTIRETY of this demand: "${text}" into declarative language. Ensure all parts of the user's request are addressed gracefully in each suggestion. Tone: ${toneInstruction}${lengthInstruction}${existingList}`;

    try {
        const ai = new GoogleGenAI({ apiKey });

        // Race the API call against a 30-second timeout
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out. The AI service took too long to respond.')), 30000)
        );

        const apiPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
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
