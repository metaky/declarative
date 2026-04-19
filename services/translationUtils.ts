import type { Translation, VariationCache, VariationHistoryMap } from '../types';

export const createEntityId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeTranslationText = (value: string) => value.trim().replace(/\s+/g, ' ');

export const ensureTranslations = (values: Array<Partial<Translation> & { translation: string }>): Translation[] => (
  values
    .map((value) => {
      const translation = normalizeTranslationText(value.translation || '');
      if (!translation) return null;

      return {
        id: typeof value.id === 'string' && value.id.trim() ? value.id : createEntityId('translation'),
        translation,
      };
    })
    .filter((value): value is Translation => value !== null)
);

export const cloneTranslations = (translations: Translation[]) => (
  translations.map((item) => ({ id: item.id, translation: item.translation }))
);

export const cloneVariationCache = (variations?: VariationHistoryMap): VariationHistoryMap => {
  if (!variations) return {};

  return Object.fromEntries(
    Object.entries(variations).map(([sourceId, cache]) => [
      sourceId,
      Object.fromEntries(
        Object.entries(cache).map(([kind, translations]) => [kind, cloneTranslations(translations || [])])
      ) as VariationCache,
    ])
  );
};

export const countSavedVariationSets = (variations?: VariationHistoryMap) => {
  if (!variations) return 0;

  return Object.values(variations).reduce((count, cache) => (
    count + Object.values(cache).filter((translations) => Array.isArray(translations) && translations.length > 0).length
  ), 0);
};
