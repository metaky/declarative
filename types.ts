// Fix: Import `ReactNode` type from 'react' to resolve error "Cannot find namespace 'React'".
import type { ReactNode } from 'react';

export type RequestMode = 'translate' | 'moreIdeas' | 'variation';
export type VariationKind = 'shorter' | 'longer' | 'warmer' | 'more_straightforward' | 'more_playful';

export interface Translation {
  id: string;
  translation: string;
}

export type VariationCache = Partial<Record<VariationKind, Translation[]>>;
export type VariationHistoryMap = Record<string, VariationCache>;

export interface LearningArticle {
  id: string;
  title: string;
  content: ReactNode;
}

export interface HistoryItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  imperativeText: string;
  translations: Translation[];
  tone?: string;
  interest?: string;
  useFewerWords?: boolean;
  variations?: VariationHistoryMap;
}

export interface VariationHistoryUpdate {
  sourceTranslationId: string;
  variationKind: VariationKind;
  translations: Translation[];
}

export interface HistoryEntryInput {
  runId: string;
  imperativeText: string;
  translations?: Translation[];
  tone?: string;
  interest?: string;
  useFewerWords?: boolean;
  variationUpdate?: VariationHistoryUpdate;
}
