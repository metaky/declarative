export const systemInstruction = `You are an AI assistant named "Declarative," designed as a co-regulation tool for parents and caregivers of children with a Pathological Demand Avoidance (PDA) profile. Your primary job is to turn caregiver demands into real, sayable, low-pressure language.

Quality order:
1. **Real caregiver speech:** Every suggestion should sound like something a calm adult could actually say to a child in the moment. Avoid captions, slogans, therapy-speak, stiff rules, and awkward AI phrasing.
2. **Felt safety and autonomy:** Reduce pressure without manipulating, shaming, cornering, bargaining, praise-pressuring, or hiding a command inside a fake observation.
3. **Full practical meaning:** Keep the action, safety concern, location, sequence, and destination when they matter.
4. **Tone behavior:** Match the selected tone as a strategy, not as decorative flavor.
5. **Brevity:** Short is good only when it stays complete and usable.

Declarative strategies you may use:
- Situation or task observation: what is ready, happening, changing, waiting, or available.
- Shared wondering, questions, or problem-solving: a genuine collaborative thought that softens the demand, not a disguised question-demand or fake choice.
- Self-narration: what the adult is doing next, when it is authentic and not guilt-based.
- Concrete redirection: a low-pressure statement of where/when the action fits better.

Questions are allowed when they feel natural and useful. Use them as one strategy in the mix; avoid turning every option into a question or using questions to sneak in a command. The main exception is Equalizing + Fewer Words, where compact questions can be the clearest way to let the child be the checker, expert, or leader.

Avoid overusing environment-first phrasing. "The floor is for walking" style captions often sound like rules. Use environment observations only when they feel natural and useful.

Hard requirements:
- Multi-step requests must keep the important steps together.
- Safety or speed prompts must keep a concrete safer alternative, such as walking inside or running outside, without threat language.
- Cleanup or put-away prompts must keep the destination.
- Interest Based outputs with an entered interest must use that interest or a recognizable element from it in every returned suggestion; no plain non-interest fallback suggestion is allowed for that tone.
- Interest Based outputs must use the interest meaningfully and factually. The interest element needs to do real work in the logic of the sentence; do not use arbitrary references, false labels, or invented themed objects just to satisfy the tone.
- Before returning, privately reject weak candidates that are vague, gimmicky, command-like, emotionally loaded, or not sayable.

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

function normalizeInterestName(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
    let toneInstruction = `Use "Default": natural, warm, and easy to say out loud. Prefer grounded conversational wording over perfect declarative theory.`;
    if (tone && tone !== 'Default') {
        const normalizedInterest = normalizeInterestName(interest);
        const isPokemonInterest = normalizedInterest === 'pokemon';
        switch (tone) {
            case 'Straightforward':
                toneInstruction = `Use "Straightforward": clear, practical, and calm. Get to the point without orders, faux choices, clipped bossiness, jokes, or emotional pressure. A plain helpful statement is better than a clever declarative frame.`;
                break;
            case 'Interest Based':
                toneInstruction = interest
                    ? `Use "Interest Based": every returned suggestion must meaningfully incorporate "${interest}" or a recognizable element from "${interest}". Prefer returning exactly 3 strong suggestions over adding a fourth weak filler suggestion. A plain non-interest option is a miss for this tone. A bare name-drop is also a miss; the interest element must do real work in the logic of the sentence by connecting to the task through a relevant action, tool, place, character trait, route, checkpoint, comparison, or relationship. Keep the interest as a grounded connection unless the original request says the interest is physically present. Do not borrow vocabulary from a different interest; for example, do not use Pokemon, Trainer, Poke-stop, Gym, Squirtle, Pikachu, or Pokemon route language unless the entered interest is Pokemon. ${isPokemonInterest ? 'For Pokemon, favor concrete elements that naturally map to the moment: Squirtle/water/sink, Poke-stop/transition stop, Trainer/route, Pikachu/speed, and careful Pokemon steps. "The sink is like Squirtle, helping with water" and "the sink is our next Poke-stop before dinner" are integrated; "Pokemon quick stop: hands, then dinner" is just a name-drop. Avoid generic game-ish words like team, checkpoint, evolve, challenge, map challenge, or move names unless they are paired with a recognizable Pokemon element and clearly explain the real task. Do not use vague move-language like "rapid-fire attack" for handwashing. Do not use generic "pickup challenge" wording for cleanup unless it includes a Pokemon-specific frame.' : 'For non-Pokemon interests, use only details that belong naturally to the entered interest, and do not reuse Pokemon-specific examples. Use interest-world objects, vehicles, places, or characters as comparisons only; do not make them real props, destinations, storage, or story facts in the room.'} Do not invent ${interest} objects/cards/TV/plates/props, story worlds, battles, quests, or character actions. Do not rename real objects as ${interest} items unless the caregiver did. Do not put ${interest} directly in front of real task nouns like toys, hands, hand wash, dinner, sink, room, floor, house, cleanup, storage, or things. The real task stays primary.`
                    : `Use "Interest Based" with no entered interest: do not pretend there is an interest. Fall back to natural, warm, low-pressure Default wording.`;
                break;
            case 'Equalizing':
                toneInstruction = `Use "Equalizing": make status-leveling the real move. Let the child be the checker, expert, leader, route planner, or destination boss, or let the adult be gently unsure/forgetful. Keep dignity; no mocking, helplessness, sarcasm, or performance. Vary the frame so it does not sound templated.`;
                break;
            case 'Humorous':
                toneInstruction = `Use "Humorous": add a little lift through rhythm or one small playful image. Keep it usable, short, and anchored to the task. Avoid sarcasm, teasing, shame, injury warnings, overstimulation, big story worlds, and forced jokes.`;
                break;
        }
    }

    return toneInstruction;
}

function buildContextInstruction(text, tone, interest) {
    const normalized = text.toLowerCase();
    const instructions = [];
    const hasInterest = tone === 'Interest Based' && Boolean(interest);
    const isPokemonInterest = hasInterest && normalizeInterestName(interest) === 'pokemon';
    const isEqualizing = tone === 'Equalizing';

    if (/\b(stop|slow|careful|unsafe|danger|hurt)\b/.test(normalized) && /\b(run|running|fast|speed|jump|climb)\b/.test(normalized)) {
        instructions.push('Safety case: avoid threat/harm warnings; keep a low-pressure alternative like walking speed inside or running outside.');
        if (tone === 'Humorous') {
            instructions.push('Humorous safety: keep one light image or rhythm while preserving the safer alternative. Good shapes: "Zoom belongs outside." / "Fast feet need the yard." / "Inside feet do the slow show."');
        }
        if (hasInterest) {
            instructions.push(isPokemonInterest
                ? `Interest Based safety: use "${interest}" or a recognizable Pokemon element to explain pace or place. Good shapes: "Walking inside, like careful Pokemon steps. Fast speed fits outside." / "Trainer walking speed inside; running speed outside." Avoid random interest references that do not explain walking or running.`
                : `Interest Based safety: use "${interest}" or a recognizable element from it to explain pace or place. Good shape: "Walking inside, like careful ${interest} steps. Fast speed fits outside." Do not borrow Pokemon/Trainer/Poke-stop language unless the entered interest is Pokemon.`);
        }
    }

    if (/\b(dinner|lunch|breakfast|eat|food)\b/.test(normalized) && /\b(hand|hands|wash|sink)\b/.test(normalized)) {
        instructions.push('Meal sequence: keep coming down/downstairs when present, handwashing, and meal timing in each option. If the request says come down and wash hands, preserve that order: down, hands, dinner. Do not reverse it into hands first, then down.');
        if (hasInterest) {
            instructions.push(isPokemonInterest
                ? `Interest Based meal transition: use "${interest}" or a recognizable Pokemon element to make the sequence or wash-up make sense. Good Pokemon-like shapes: "The sink is like Squirtle, washing hands before dinner." / "The sink is our next Poke-stop before dinner." / "Trainer route: downstairs, sink, then dinner." Bad shapes: "${interest} hand wash," "${interest} clean hands," "${interest}-level clean," "${interest}-strong hands," "${interest} quick stop: hands, then dinner," generic "quick stop" without Poke-stop/Squirtle/Trainer logic, generic "next evolution" without a concrete Pokemon connection, "Quick Attack" or "rapid-fire attack" for handwashing, "${interest} dinner," "Poke-center" for the sink, or turning dinner, hands, plates, or the sink into ${interest} objects.`
                : `Interest Based meal transition: use "${interest}" or a recognizable element from it to make the sequence or wash-up make sense without turning hands, dinner, food, plates, or the sink into ${interest} objects. Prefer "like..." comparisons, route/path wording, or gentle style references. Bad shapes include renaming dinner/food as ${interest} items, invented character actions, story events, themed props, or themed places as if they are real. Do not borrow Pokemon/Trainer/Poke-stop/Squirtle language unless the entered interest is Pokemon.`);
        }
    }

    if (/\b(pick up|put\b.*\baway|clean|cleanup|toys?|blocks?|clothes?)\b/.test(normalized) && /\b(upstairs|room|bedroom|closet|shelf|basket|bin|drawer)\b/.test(normalized)) {
        instructions.push('Cleanup destination: keep both picking up/putting away and the destination.');
        if (isEqualizing) {
            instructions.push('Equalizing cleanup: keep the child powerful by making them the route/destination expert or making the adult gently confused/stuck. Good shapes: "Wait, do the toys go upstairs?" / "I am stuck on the toy route." / "You know the upstairs toy spots." Bad shapes: plain "Toys upstairs?" or "Toy reset goes upstairs" with no status-leveling move.');
        }
        if (hasInterest) {
            instructions.push(isPokemonInterest
                ? `Interest Based cleanup: use "${interest}" or a recognizable Pokemon element as a route, map, or trainer path while keeping the facts unchanged. Good shapes: "${interest}-style route for these toys: upstairs to your room." / "Trainer route for these toys: upstairs to your room." Bad shapes: "${interest} toys," "${interest} things," any Poke-stop wording for cleanup, "Toy Poke-stop," "upstairs room Poke-stop," "Poke-stop for these," generic "toy team/checkpoint/evolve/pickup challenge/map challenge" language without Pokemon logic, "Pokemon gym challenge" for cleanup, "${interest} storage," "Toys to the Poke-stop upstairs," or sending toys to a pretend ${interest} place.`
                : `Interest Based cleanup: use "${interest}" or a recognizable element from it as a style, route, map, path, or comparison while keeping the facts unchanged. Good shape: "${interest}-style route for these toys: upstairs to your room." Prefer "like..." comparisons over turning the toys into part of the interest world. Bad shapes: "${interest} toys," "${interest} things," "${interest} storage," mining/crafting the toys, putting toys into invented ${interest} containers/vehicles/places, making toys ride interest vehicles, or Pokemon/Trainer/Poke-stop language unless the entered interest is Pokemon.`);
        }
    }

    return instructions.length > 0 ? ` ${instructions.join(' ')}` : '';
}

function buildFewerWordsInstruction(text, tone, interest) {
    const normalized = text.toLowerCase();
    const isPokemonInterest = tone === 'Interest Based' && Boolean(interest) && normalizeInterestName(interest) === 'pokemon';
    const instructions = [
        'Fewer Words is a hard filter: make every option materially shorter than standard mode, usually 4-9 words for simple moments and 6-12 words for multi-step moments.',
        'Cut filler such as "it looks like", "seems", "part of", "right now", and long setup phrases unless a word is doing real work.',
        'Compact questions are allowed when they soften the demand. Do not use fake choices or question-demands. Outside Equalizing, vary sentence shape so questions are not the only strategy.',
        'Keep the important safety, sequence, location, and destination details even when phrasing is clipped.',
    ];

    if (/\b(stop|slow|careful|unsafe|danger|hurt)\b/.test(normalized) && /\b(run|running|fast|speed|jump|climb)\b/.test(normalized)) {
        instructions.push('Safety shapes: "Walking inside. Running outside." / "Fast feet fit outside."');
    }

    if (/\b(dinner|lunch|breakfast|eat|food)\b/.test(normalized) && /\b(hand|hands|wash|sink)\b/.test(normalized)) {
        instructions.push('Meal shapes: "Dinner is ready. Hands first." / "Downstairs, hands, dinner?" If the request says come down and wash hands, preserve that order: down, hands, dinner. Do not reverse it into hands first, then down.');
    }

    if (/\b(pick up|put\b.*\baway|clean|cleanup|toys?|blocks?|clothes?)\b/.test(normalized) && /\b(upstairs|room|bedroom|closet|shelf|basket|bin|drawer)\b/.test(normalized)) {
        instructions.push('Cleanup shapes: "Toys upstairs in your room?" / "Toy reset goes upstairs."');
    }

    if (tone === 'Equalizing') {
        instructions.push('For Equalizing, every compact option still needs an obvious status move: adult unsure/stuck/forgetful, or child as checker/expert/leader. Good shapes: "Wait, do toys go upstairs?" / "I am stuck. Toy route?" / "You know the toy spots." / "Can you check the dinner order?" Plain captions like "Toys upstairs?" do not count as Equalizing.');
    }

    if (tone === 'Humorous') {
        instructions.push('For Humorous, use one tiny playful image or rhythm with no setup: "Toy mountain could go upstairs." / "Sink cameo, then dinner."');
    }

    if (tone === 'Interest Based') {
        if (interest) {
            instructions.push(`For Interest Based, every compact option must still include "${interest}" or a recognizable element from it, and that element must connect logically to the task. Keep real nouns factual: "Toys up the ${interest} route?" is better than "${interest} toys upstairs" unless the caregiver said the toys are ${interest}.`);
            if (isPokemonInterest && /\b(pick up|put\b.*\baway|clean|cleanup|toys?|blocks?|clothes?)\b/.test(normalized)) {
                instructions.push('For Pokemon cleanup, do not use Poke-stop. Use compact Pokemon route or Trainer path language instead.');
            }
        } else {
            instructions.push('No interest was entered, so do not force an Interest Based frame.');
        }
    }

    return ` CRITICAL: ${instructions.join(' ')}`;
}

export function buildTranslationPrompt({
    text,
    existingTranslations = [],
    tone,
    interest,
    useFewerWords,
}) {
    const toneInstruction = getToneInstruction(tone, interest);
    const contextInstruction = buildContextInstruction(text, tone, interest);

    const lengthInstruction = useFewerWords ? buildFewerWordsInstruction(text, tone, interest) : '';
    const followUpCoverage = buildFollowUpCoverage(existingTranslations);
    const followUpInstruction = existingTranslations.length > 0
        ? `\nCovered angles: ${followUpCoverage.usedAngles}. Used openings: ${followUpCoverage.openingPatterns.join('; ')}. Underused angles to lean on next: ${followUpCoverage.underusedAngles}. Write 3-4 genuinely new alternatives. Treat those angles, openings, and sentence shapes as used. Favor the underused angles first, start each suggestion differently from the earlier set, and avoid stock frames or recycled sentence skeletons.`
        : '';

    return `Rewrite into 3-4 declarative alternatives that preserve full meaning while reducing pressure: "${text}". Address all parts.${contextInstruction} Tone: ${toneInstruction}${lengthInstruction}

Privately draft more candidates than you need, then return only the best 3-4. Keep the winners varied. A winning set should include at least 1-2 options a real caregiver could use immediately. Reject candidates that sound like rules, vague captions, hidden commands, gimmicks, emotional pressure, generic AI phrasing, or tone-mismatched filler. If the tone is Interest Based and an interest was entered, reject every candidate that does not use the interest or a recognizable element from it in a way that logically connects to the task, and reject candidates that incorporate the interest by falsely renaming the real task objects. Return only the JSON array.${followUpInstruction}`;
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
    const contextInstruction = buildContextInstruction(text, tone, interest);

    const variationInstructions = {
        shorter: `Variation direction: "Shorter". Preserve core meaning: action, safety, location, sequence, destination. Compact the same source angle; no weaker/vaguer switch. If already short, make a different compact version, not a deletion. Do not become clipped, abrupt, or bossy.`,
        longer: `Variation direction: "Longer". Make both rewrites a little fuller and smoother than the source suggestion. Add only enough context or connective tissue to improve flow. Do not add new demands, emotional pressure, or invented details.`,
        warmer: `Variation direction: "Warmer". Make both rewrites slightly softer and more connecting than the source suggestion. Keep them grounded and low-pressure. Do not become sweeter, more reassuring, more parent-centered, or emotionally loaded.`,
        more_straightforward: `Variation direction: "More straightforward". Make both rewrites plainer, calmer, and more direct than the source suggestion. Keep the language observation-first when natural. Do not become clipped, bossy, or command-like.`,
        more_playful: `Variation direction: "More playful". Make both rewrites a little lighter in rhythm or wording than the source suggestion while staying grounded and easy to say out loud. Do not turn them into jokes, gimmicks, or full humorous roleplay unless the selected tone already supports that level of play.`,
    };

    const lengthInstruction = useFewerWords
        ? 'Respect the existing "Fewer Words" preference unless the chosen variation direction is "Longer", in which case slightly fuller wording is allowed while staying compact.'
        : '';

    return `Refine one existing declarative suggestion into exactly 2 new declarative rewrites.\n\nOriginal caregiver request: "${text}"${contextInstruction}\nSelected source suggestion: "${sourceTranslation}"\nTone: ${toneInstruction}\n${variationInstructions[variationKind]}\n${lengthInstruction}\n\nPrivately draft several possibilities and return only the best 2.\n\nRequirements:\n- Preserve the full meaning of the original caregiver request.\n- Stay anchored to the selected source suggestion unless that source is weak, vague, or rule-like; then preserve the request and make the angle more usable.\n- Keep the same low-pressure spirit and the same general tone family as the source suggestion.\n- Make the 2 rewrites meaningfully different from each other in opening words and sentence shape, not just tiny wording swaps.\n- Keep both rewrites authentic and useful in a real caregiver moment.\n- If the tone is Interest Based and an interest was entered, both rewrites must use the interest or a recognizable element from it in a way that logically connects to the task, without falsely renaming the real task objects.\n- Do not drop important parts of the request.\n- Do not become more manipulative, more praising, more performative, or more emotionally loaded.\n- Do not use generic fallback phrasing or near-duplicates of the source suggestion.\n\nReturn only the valid JSON array.`;
}
