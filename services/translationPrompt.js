export const systemInstruction = `You are an AI assistant named "Declarative," designed as a co-regulation tool for parents and caregivers of children with a Pathological Demand Avoidance (PDA) profile. Your primary goal is to help users rephrase their imperative commands (demands) into gentle, connecting, and non-demanding declarative language.

Your core principles are:
1.  **Connection, Not Compliance:** Success is measured by building trust and "felt safety," not by achieving task completion.
2.  **Calm by Design:** Your tone must be gentle, supportive, and understanding.
3.  **Authenticity First:** Actively warn against manipulative phrasing. Your suggestions must be authentic invitations, not passive-aggressive commands. Prioritize the "Give Over Get" mindset.
4.  **Empathy-Driven AI:** Always offer options, not directives. Root suggestions in autonomy and respect.
5.  **Objective Situational Framing:** Prefer environment-first or task-first observations over caregiver-first framing. Describe what is happening in the situation before describing anyone's internal state.

When a user provides a statement, you must:
1.  **Address the Whole Statement:** CRITICAL: If the user provides a statement with multiple distinct parts or tasks (e.g., "Wash your hands and sit at the table"), ensure your declarative suggestions gracefully address ALL parts of the request. Do not omit details; instead, weave them together into a coherent, non-demanding narrative that acknowledges the full context.
2.  **Recognize Intent:** Understand the underlying goal and context.
3.  **Remove Demands:** Eliminate direct commands and obligation words ("need to," "must," "please do X").
4.  **Reframe Declaratively:** Generate 3-4 varied alternatives (Observation, Self-Narrate, Invitation, Problem-Solving).
5.  **Filter for Authenticity:** Discard any phrasing that sounds manipulative or like a "test."
6.  **Lead With the Situation:** Favor objective observations about the environment, task, timing, sensory context over statements centered on the caregiver's body, emotions, preferences, or concerns.
7.  **Neutralize Perspective:** Avoid relying on narrator-led setups such as "I'm noticing...", "I need...", "I want...", "My body feels...", or "I'm worried..." when the same idea can be expressed as an objective description of the situation.
8.  **Reduce Emotional Demand:** Minimize language that highlights the caregiver's internal state, personal need, disappointment, urgency, or stress, because this can function like an implicit emotional demand.
9.  **Use 'I' Sparingly:** Aim for roughly a 3:1 ratio of objective observations to "I" statements. Use "I" statements only when they add natural variety, soften a collaborative idea, or express a genuine shared thought such as "I wonder if...".

Your output must be a valid JSON array of objects.`;

const SUMMARY_STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'before', 'by', 'can', 'do', 'for',
    'from', 'get', 'go', 'going', 'help', 'here', 'if', 'in', 'into', 'is', 'it',
    'its', 'just', 'make', 'next', 'of', 'off', 'on', 'or', 'our', 'out', 'part',
    'ready', 'so', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they',
    'this', 'to', 'up', 'us', 'we', 'what', 'when', 'with', 'would', 'you', 'your',
]);

const ANGLE_ORDER = ['setup', 'transition', 'logistics', 'shared'];

function normalizeForSummary(text) {
    return text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/g, '');
}

function classifyExistingAngle(text) {
    const normalized = text.toLowerCase();

    if (/^i wonder\b|^i'm\b|^i am\b|^we\b|^our\b/.test(normalized)) {
        return 'shared perspective';
    }

    if (/\b(before|after|then|next|first|path|route|sequence|part)\b/.test(normalized)) {
        return 'sequence';
    }

    if (/\b(help|easier|expert|better way|smarter way|second opinion)\b/.test(normalized)) {
        return 'problem-solving';
    }

    if (/\b(ready|waiting|open|set|light|sink|door|table|outside|counter|spot)\b/.test(normalized)) {
        return 'environment or setup';
    }

    return 'grounded observation';
}

function buildKeyFragment(text) {
    const normalized = normalizeForSummary(text)
        .replace(/^(it looks like|there is|there's|there are|i wonder if|i wonder|i'm thinking|i am thinking|maybe|should we|do we want to)\s+/i, '')
        .replace(/^(the|a|an)\s+/i, '');

    const words = normalized
        .split(/\s+/)
        .filter(word => !SUMMARY_STOP_WORDS.has(word.toLowerCase()))
        .slice(0, 6);

    if (words.length === 0) {
        return normalized.toLowerCase();
    }

    return words.join(' ').toLowerCase();
}

function normalizeAngleLabel(angle) {
    if (angle === 'environment or setup' || angle === 'grounded observation') return 'setup';
    if (angle === 'sequence') return 'transition';
    if (angle === 'problem-solving') return 'logistics';
    if (angle === 'shared perspective') return 'shared';
    return 'setup';
}

function extractOpeningPattern(text) {
    const normalized = normalizeForSummary(text)
        .toLowerCase()
        .replace(/^["'([{]+/, '');

    return normalized
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join(' ');
}

function buildFollowUpCoverage(existingTranslations = []) {
    const grouped = new Map();
    const openingPatterns = [];
    const seenOpenings = new Set();
    const angleCounts = new Map(ANGLE_ORDER.map(label => [label, 0]));

    for (const item of existingTranslations) {
        if (!item?.translation) continue;

        const angle = normalizeAngleLabel(classifyExistingAngle(item.translation));
        const fragment = buildKeyFragment(item.translation);
        const existing = grouped.get(angle) || [];
        if (existing.length < 2) {
            existing.push(fragment);
            grouped.set(angle, existing);
        }

        angleCounts.set(angle, (angleCounts.get(angle) || 0) + 1);

        const opening = extractOpeningPattern(item.translation);
        if (opening && !seenOpenings.has(opening) && openingPatterns.length < 6) {
            seenOpenings.add(opening);
            openingPatterns.push(opening);
        }
    }

    const usedAngles = Array.from(grouped.entries())
        .map(([angle, fragments]) => `${angle} (${fragments.join('; ')})`)
        .join(' | ');

    const underusedAngles = ANGLE_ORDER
        .slice()
        .sort((left, right) => (angleCounts.get(left) || 0) - (angleCounts.get(right) || 0))
        .slice(0, 2)
        .join(', ');

    return {
        usedAngles,
        openingPatterns,
        underusedAngles,
    };
}

export function summarizeExistingTranslations(existingTranslations = []) {
    const coverage = buildFollowUpCoverage(existingTranslations);
    const summaries = [];

    if (coverage.usedAngles) {
        summaries.push(`angles: ${coverage.usedAngles}`);
    }

    if (coverage.openingPatterns.length > 0) {
        summaries.push(`openings: ${coverage.openingPatterns.join('; ')}`);
    }

    if (coverage.underusedAngles) {
        summaries.push(`underused: ${coverage.underusedAngles}`);
    }

    return summaries;
}

export function getToneInstruction(tone, interest) {
    let toneInstruction = `Use a neutral, warm, observational tone with simple everyday wording.`;
    if (tone && tone !== 'Default') {
        switch (tone) {
            case 'Straightforward':
                toneInstruction = `Use a "Straightforward" tone: calm, plainspoken, and to the point with a low emotional temperature. Prefer concise observation-first phrasing and gentle availability cues over questions. Across the 3-4 suggestions, include 1-2 concise options and at least 1 slightly fuller option. Use simple everyday wording and keep the suggestions varied. Avoid jokes, hype, slang, roleplay, exaggerated metaphors, faux-choice pressure, and clipped or bossy phrasing.`;
                break;
            case 'Interest Based':
                toneInstruction = interest
                    ? `Use an "Interest Based" tone. Weave in "${interest}" with specific but light references. Let the interest add connection without turning the line into a performance, gimmick, or the main point. Avoid overstimulation and references that overpower the meaning.`
                    : `Use an "Interest Based" tone that feels playful and engaging while staying grounded and low-pressure. Avoid overstimulation or playfulness that distracts from the meaning.`;
                break;
            case 'Equalizing':
                toneInstruction = `Use an "Equalizing" tone: a status-leveling role or adult-uncertainty move is the main declarative frame, not extra flavor. Every suggestion should lower adult authority via child-as-expert/checker/leader, adult-as-unsure/silly/forgetful, or both. For multi-step requests, make the child the route/order/checklist expert. Name the child's role when natural: expert, checker, leader, order boss, or route planner. Use statements, not direct help questions. Keep dignity; avoid mocking, helplessness, sarcasm, praise-pressure, or performance.`;
                break;
            case 'Humorous':
                toneInstruction = `Use a "Humorous" tone. Use light, gentle absurdity to lower pressure while keeping the meaning clear. Humor should support connection, not distract from the point. Keep it warm and easy to understand. Avoid sarcasm, ridicule, teasing, and overstimulation.`;
                break;
        }
    }

    return toneInstruction;
}

export function buildTranslationPrompt({
    text,
    existingTranslations = [],
    tone,
    interest,
    useFewerWords,
}) {
    const toneInstruction = getToneInstruction(tone, interest);

    const lengthInstruction = useFewerWords ? ' CRITICAL: Keep suggestions short when possible, but if the request has multiple important parts, prioritize completeness and clarity over extreme brevity.' : '';
    const followUpCoverage = buildFollowUpCoverage(existingTranslations);
    const followUpInstruction = existingTranslations.length > 0
        ? `\nCovered angles: ${followUpCoverage.usedAngles}. Used openings: ${followUpCoverage.openingPatterns.join('; ')}. Underused angles to lean on next: ${followUpCoverage.underusedAngles}. Write 3-4 genuinely new alternatives. Treat those angles, openings, and sentence shapes as used. Favor the underused angles first, start each suggestion differently from the earlier set, and avoid stock frames or recycled sentence skeletons.`
        : '';

    return `Rewrite this statement into 3-4 declarative alternatives that preserve the full meaning while reducing pressure: "${text}". Ensure all parts of the user's request are addressed gracefully in each suggestion. Lead with environment-first or task-first observations whenever possible rather than caregiver-centered phrasing. At least 3 of the 4 suggestions should begin with objective observations about the environment, task, timing, sensory context, or situation rather than with caregiver-first language. Avoid starting multiple suggestions with "I", "I'm", "I am", "my", "we", or "our". Tone: ${toneInstruction}${lengthInstruction}${followUpInstruction}`;
}

export function buildVariationPrompt({
    text,
    sourceTranslation,
    variationKind,
    tone,
    interest,
    useFewerWords,
}) {
    const toneInstruction = getToneInstruction(tone, interest);

    const variationInstructions = {
        shorter: `Variation direction: "Shorter". Make both rewrites tighter and more concise than the source suggestion while preserving every important part of the original caregiver request. Do not become clipped, abrupt, or bossy.`,
        longer: `Variation direction: "Longer". Make both rewrites a little fuller and smoother than the source suggestion. Add only enough context or connective tissue to improve flow. Do not add new demands, emotional pressure, or invented details.`,
        warmer: `Variation direction: "Warmer". Make both rewrites slightly softer and more connecting than the source suggestion. Keep them grounded and low-pressure. Do not become sweeter, more reassuring, more parent-centered, or emotionally loaded.`,
        more_straightforward: `Variation direction: "More straightforward". Make both rewrites plainer, calmer, and more direct than the source suggestion. Keep the language observation-first when natural. Do not become clipped, bossy, or command-like.`,
        more_playful: `Variation direction: "More playful". Make both rewrites a little lighter in rhythm or wording than the source suggestion while staying grounded and easy to say out loud. Do not turn them into jokes, gimmicks, or full humorous roleplay unless the selected tone already supports that level of play.`,
    };

    const lengthInstruction = useFewerWords
        ? 'Respect the existing "Fewer Words" preference unless the chosen variation direction is "Longer", in which case slightly fuller wording is allowed while staying compact.'
        : '';

    return `Refine one existing declarative suggestion into exactly 2 new declarative rewrites.\n\nOriginal caregiver request: "${text}"\nSelected source suggestion: "${sourceTranslation}"\nTone: ${toneInstruction}\n${variationInstructions[variationKind]}\n${lengthInstruction}\n\nRequirements:\n- Preserve the full meaning of the original caregiver request.\n- Stay anchored to the selected source suggestion rather than inventing a totally new angle.\n- Keep the same low-pressure spirit and the same general tone family as the source suggestion.\n- Make the 2 rewrites meaningfully different from each other in opening words and sentence shape, not just tiny wording swaps.\n- Keep both rewrites authentic and useful in a real caregiver moment.\n- Do not drop important parts of the request.\n- Do not become more manipulative, more praising, more performative, or more emotionally loaded.\n- Do not use generic fallback phrasing or near-duplicates of the source suggestion.\n\nReturn only the valid JSON array.`;
}
