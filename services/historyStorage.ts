import type { HistoryEntryInput, HistoryItem, Translation } from '../types';

const HISTORY_STORAGE_KEY = 'translationHistory';
const HISTORY_STORAGE_VERSION = 2;
const MAX_HISTORY_ENTRIES = 30;

interface HistoryStoragePayload {
  version: number;
  entries: HistoryItem[];
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const createHistoryId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `history-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeTranslation = (value: unknown): Translation | null => {
  if (!isRecord(value) || typeof value.translation !== 'string') {
    return null;
  }

  const translation = value.translation.trim();
  return translation ? { translation } : null;
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
    id: typeof value.id === 'string' && value.id.trim() ? value.id : createHistoryId(),
    createdAt: normalizeTimestamp(value.createdAt, typeof value.id === 'string' ? value.id : undefined),
    imperativeText,
    translations,
    tone: typeof value.tone === 'string' && value.tone.trim() ? value.tone : undefined,
    interest: typeof value.interest === 'string' && value.interest.trim() ? value.interest.trim() : undefined,
    useFewerWords: value.useFewerWords === true,
  };
};

const sortHistoryEntries = (entries: HistoryItem[]) => (
  [...entries].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
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

export const prependHistoryEntry = (
  entries: HistoryItem[],
  entry: HistoryEntryInput
): HistoryItem[] => {
  const createdAt = new Date().toISOString();

  return [
    {
      id: createHistoryId(),
      createdAt,
      imperativeText: entry.imperativeText.trim(),
      translations: entry.translations.map(item => ({ translation: item.translation.trim() })),
      tone: entry.tone,
      interest: entry.interest?.trim() || undefined,
      useFewerWords: Boolean(entry.useFewerWords),
    },
    ...entries,
  ].slice(0, MAX_HISTORY_ENTRIES);
};
