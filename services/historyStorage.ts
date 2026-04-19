import type { HistoryEntryInput, HistoryItem, Translation, VariationHistoryMap } from '../types';
import { cloneTranslations, cloneVariationCache, createEntityId, ensureTranslations } from './translationUtils';

const HISTORY_STORAGE_KEY = 'translationHistory';
const HISTORY_STORAGE_VERSION = 3;
const MAX_HISTORY_ENTRIES = 30;

interface HistoryStoragePayload {
  version: number;
  entries: HistoryItem[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const normalizeTranslation = (value: unknown): Translation | null => {
  if (!isRecord(value) || typeof value.translation !== 'string') {
    return null;
  }

  const [translation] = ensureTranslations([{
    id: typeof value.id === 'string' ? value.id : undefined,
    translation: value.translation,
  }]);

  return translation || null;
};

const normalizeTimestamp = (value: unknown, fallback?: string) => {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }

  if (fallback && !Number.isNaN(Date.parse(fallback))) {
    return new Date(fallback).toISOString();
  }

  return new Date().toISOString();
};

const normalizeVariationHistory = (value: unknown): VariationHistoryMap => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([sourceTranslationId, cacheValue]) => {
        if (!isRecord(cacheValue)) {
          return null;
        }

        const normalizedEntries = Object.fromEntries(
          Object.entries(cacheValue)
            .map(([variationKind, translationsValue]) => {
              const translations = (Array.isArray(translationsValue) ? translationsValue : [])
                .map(normalizeTranslation)
                .filter((translation): translation is Translation => translation !== null);

              if (translations.length === 0) {
                return null;
              }

              return [variationKind, translations];
            })
            .filter((entry): entry is [string, Translation[]] => entry !== null)
        );

        return [sourceTranslationId, normalizedEntries];
      })
      .filter((entry): entry is [string, VariationHistoryMap[string]] => entry !== null && Object.keys(entry[1]).length > 0)
  );
};

const normalizeHistoryItem = (value: unknown): HistoryItem | null => {
  if (!isRecord(value) || typeof value.imperativeText !== 'string') {
    return null;
  }

  const imperativeText = value.imperativeText.trim();
  if (!imperativeText) {
    return null;
  }

  const translations = (Array.isArray(value.translations) ? value.translations : [])
    .map(normalizeTranslation)
    .filter((translation): translation is Translation => translation !== null);

  if (translations.length === 0) {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : createEntityId('history'),
    createdAt: normalizeTimestamp(value.createdAt, typeof value.id === 'string' ? value.id : undefined),
    updatedAt: normalizeTimestamp(value.updatedAt, typeof value.createdAt === 'string' ? value.createdAt : undefined),
    imperativeText,
    translations,
    tone: typeof value.tone === 'string' && value.tone.trim() ? value.tone : undefined,
    interest: typeof value.interest === 'string' && value.interest.trim() ? value.interest.trim() : undefined,
    useFewerWords: value.useFewerWords === true,
    variations: normalizeVariationHistory(value.variations),
  };
};

const sortHistoryEntries = (entries: HistoryItem[]) => (
  [...entries].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))
);

const normalizeHistoryEntries = (entries: unknown[]) => (
  sortHistoryEntries(
    entries
      .map(normalizeHistoryItem)
      .filter((entry): entry is HistoryItem => entry !== null)
  ).slice(0, MAX_HISTORY_ENTRIES)
);

export const loadHistoryEntries = (): HistoryItem[] => {
  try {
    const rawHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!rawHistory) {
      return [];
    }

    const parsed = JSON.parse(rawHistory) as unknown;

    if (Array.isArray(parsed)) {
      return normalizeHistoryEntries(parsed);
    }

    if (
      isRecord(parsed) &&
      parsed.version === HISTORY_STORAGE_VERSION &&
      Array.isArray(parsed.entries)
    ) {
      return normalizeHistoryEntries(parsed.entries);
    }

    return [];
  } catch (error) {
    console.error('Could not load history from localStorage', error);
    return [];
  }
};

export const saveHistoryEntries = (entries: HistoryItem[]) => {
  try {
    const payload: HistoryStoragePayload = {
      version: HISTORY_STORAGE_VERSION,
      entries: normalizeHistoryEntries(entries),
    };

    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Could not save history to localStorage', error);
  }
};

export const clearHistoryEntries = () => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error('Could not clear history from localStorage', error);
  }
};

export const upsertHistoryEntry = (
  entries: HistoryItem[],
  entry: HistoryEntryInput
): HistoryItem[] => {
  const timestamp = new Date().toISOString();
  const existingEntryIndex = entries.findIndex((item) => item.id === entry.runId);
  const existingEntry = existingEntryIndex >= 0 ? entries[existingEntryIndex] : null;
  const nextVariations = cloneVariationCache(existingEntry?.variations);

  if (entry.variationUpdate) {
    const currentCache = nextVariations[entry.variationUpdate.sourceTranslationId] || {};
    nextVariations[entry.variationUpdate.sourceTranslationId] = {
      ...currentCache,
      [entry.variationUpdate.variationKind]: cloneTranslations(entry.variationUpdate.translations),
    };
  }

  const nextEntry: HistoryItem = {
    id: entry.runId,
    createdAt: existingEntry?.createdAt || timestamp,
    updatedAt: timestamp,
    imperativeText: entry.imperativeText.trim(),
    translations: entry.translations ? cloneTranslations(entry.translations) : cloneTranslations(existingEntry?.translations || []),
    tone: entry.tone,
    interest: entry.interest?.trim() || undefined,
    useFewerWords: Boolean(entry.useFewerWords),
    variations: nextVariations,
  };

  const remainingEntries = existingEntryIndex >= 0
    ? entries.filter((item) => item.id !== entry.runId)
    : entries;

  return [
    nextEntry,
    ...remainingEntries,
  ].slice(0, MAX_HISTORY_ENTRIES);
};
