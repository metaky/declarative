const JSON_FENCE_PATTERN = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;

function normalizeForComparison(value) {
    return value.trim().toLowerCase();
}

function getTranslationText(item) {
    return item && typeof item.translation === 'string' ? item.translation : null;
}

function failure(code) {
    return { ok: false, code };
}

function parseResponseText(responseText) {
    const trimmed = typeof responseText === 'string' ? responseText.trim() : '';
    if (!trimmed) {
        return { ok: false, code: 'empty_response' };
    }

    const fenced = trimmed.match(JSON_FENCE_PATTERN);
    const jsonText = fenced ? fenced[1].trim() : trimmed;

    try {
        return { ok: true, value: JSON.parse(jsonText) };
    } catch {
        return { ok: false, code: 'json_parse_failure' };
    }
}

function isValidMode(mode) {
    return mode === 'translate' || mode === 'moreIdeas' || mode === 'variation';
}

function getBlockedResponse(response) {
    if (response?.promptFeedback?.blockReason) {
        return true;
    }

    return response?.candidates?.some((candidate) => (
        candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'BLOCKLIST'
    )) ?? false;
}

export function classifyGeminiFailure(error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (error?.name === 'AbortError' || /\b(timeout|timed out)\b/i.test(message)) {
        return 'timeout';
    }

    return 'api_error';
}

export function isGeminiResponseBlocked(response) {
    return getBlockedResponse(response);
}

export function validateGeminiResponse({
    responseText,
    mode,
    existingTranslations = [],
    sourceTranslation,
    blocked = false,
} = {}) {
    if (blocked) {
        return failure('blocked_response');
    }

    if (!isValidMode(mode)) {
        return failure('schema_failure');
    }

    const parsed = parseResponseText(responseText);
    if (!parsed.ok) {
        return parsed;
    }

    if (!Array.isArray(parsed.value)) {
        return failure('schema_failure');
    }

    const translations = [];
    for (const item of parsed.value) {
        const translation = getTranslationText(item);
        if (translation === null || !translation.trim()) {
            return failure('schema_failure');
        }
        translations.push({ translation: translation.trim() });
    }

    const excluded = new Set();
    if (mode === 'variation') {
        const source = getTranslationText(sourceTranslation);
        if (source === null || !source.trim()) {
            return failure('schema_failure');
        }
        excluded.add(normalizeForComparison(source));
    } else {
        for (const item of existingTranslations) {
            const translation = getTranslationText(item);
            if (translation && translation.trim()) {
                excluded.add(normalizeForComparison(translation));
            }
        }
    }

    const suggestions = [];
    for (const item of translations) {
        const key = normalizeForComparison(item.translation);
        if (excluded.has(key)) {
            continue;
        }
        excluded.add(key);
        suggestions.push(item);
    }

    const hasExpectedCount = mode === 'variation'
        ? suggestions.length === 2
        : suggestions.length >= 3 && suggestions.length <= 4;
    if (!hasExpectedCount) {
        return failure('output_count_failure');
    }

    return { ok: true, code: 'success', suggestions };
}
