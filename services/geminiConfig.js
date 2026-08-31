const BASELINE_CONFIG_ID = 'gemini-2.5-flash-baseline';

const GEMINI_MODEL_CONFIGURATIONS = Object.freeze([
  Object.freeze({
    id: BASELINE_CONFIG_ID,
    model: 'gemini-2.5-flash',
    thinkingBudget: 0,
    inputUsdPerMillion: 0.30,
    outputUsdPerMillion: 2.50,
    pricingVerifiedOn: '2026-08-13',
    pricingNote: 'Gemini 2.5 Flash standard paid pricing verified against official Gemini docs on 2026-08-13.',
    productionAllowed: true,
  }),
  Object.freeze({
    id: 'gemini-3.5-flash-lite-minimal',
    model: 'gemini-3.5-flash-lite',
    thinkingLevel: 'minimal',
    inputUsdPerMillion: 0.30,
    outputUsdPerMillion: 2.50,
    pricingVerifiedOn: '2026-08-13',
    pricingNote: 'Gemini 3.5 Flash-Lite standard paid pricing verified against official Gemini docs on 2026-08-13.',
    productionAllowed: true,
  }),
  Object.freeze({
    id: 'gemini-3.6-flash-minimal',
    model: 'gemini-3.6-flash',
    thinkingLevel: 'minimal',
    inputUsdPerMillion: 1.50,
    outputUsdPerMillion: 7.50,
    pricingVerifiedOn: '2026-08-13',
    pricingNote: 'Gemini 3.6 Flash standard paid pricing verified against official Gemini docs on 2026-08-13.',
    productionAllowed: true,
  }),
  Object.freeze({
    id: 'gemini-3.6-flash-medium',
    model: 'gemini-3.6-flash',
    thinkingLevel: 'medium',
    inputUsdPerMillion: 1.50,
    outputUsdPerMillion: 7.50,
    pricingVerifiedOn: '2026-08-13',
    pricingNote: 'Gemini 3.6 Flash standard paid pricing verified against official Gemini docs on 2026-08-13.',
    productionAllowed: true,
  }),
]);

export function getGeminiModelConfig(configId) {
  return GEMINI_MODEL_CONFIGURATIONS.find((config) => config.id === configId) ?? null;
}

export function resolveGeminiModelConfig({ nodeEnv, configId }) {
  if (!configId && nodeEnv !== 'production') {
    return getGeminiModelConfig(BASELINE_CONFIG_ID);
  }

  if (!configId) {
    throw new Error('GEMINI_MODEL_CONFIG is required in production.');
  }

  const config = getGeminiModelConfig(configId);
  if (!config || (nodeEnv === 'production' && !config.productionAllowed)) {
    throw new Error(`GEMINI_MODEL_CONFIG is unknown or not allowed in production: ${configId}`);
  }

  return config;
}

export function buildThinkingConfig(config) {
  if (Object.hasOwn(config, 'thinkingBudget')) {
    return { thinkingBudget: config.thinkingBudget };
  }

  return { thinkingLevel: config.thinkingLevel };
}

export function listEvaluationConfigurations() {
  return GEMINI_MODEL_CONFIGURATIONS;
}

export function estimateGeminiCostUsd(config, usageMetadata) {
  const promptTokens = usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0);
  const cost = ((promptTokens / 1_000_000) * config.inputUsdPerMillion)
    + ((outputTokens / 1_000_000) * config.outputUsdPerMillion);

  return Number(cost.toFixed(6));
}
