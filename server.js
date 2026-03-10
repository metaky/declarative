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
const redis = redisUrl && redisToken ? new Redis({
    url: redisUrl,
    token: redisToken,
}) : null;

// --- Server-Side Rate Limiting ---
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestLog = new Map();

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
        return res.status(429).json({
            error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.`
        });
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

// --- API Endpoint ---
app.post('/api/translate', async (req, res) => {
    // 1. Challenge Token Verification (Primary Bot Defense)
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

    // req.ip works reliably here because 'trust proxy' is set to true
    const clientIp = req.ip;
    const limit = checkRateLimit(clientIp);
    if (limit.limited) {
        return res.status(429).json({
            error: `Rate limit reached. Please wait ${limit.wait} seconds before trying again.`
        });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured on server.' });
    }

    const { text, existingTranslations = [], tone, interest, useFewerWords } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid "text" field.' });
    }

    if (text.length > 500) {
        return res.status(400).json({ error: 'Input text exceeds the maximum limit of 500 characters.' });
    }

    // Build tone instruction
    let toneInstruction = 'Please use a neutral, warm, and observational tone that focuses on sharing information.';
    if (tone && tone !== 'Default') {
        switch (tone) {
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
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback — serve index.html for any non-API, non-static route
app.get('{*path}', (req, res) => {
    // Prevent sending index.html for missing file assets (.js, .css, etc)
    if (req.path.includes('.')) {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'PLACEHOLDER_API_KEY') {
        console.warn('⚠️  WARNING: GEMINI_API_KEY is not set or is a placeholder. Translations will fail.');
        console.warn('   Set it in .env.local or as an environment variable.');
    }
});
