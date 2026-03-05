// Fix: Import `ReactNode` type from 'react' to resolve error "Cannot find namespace 'React'".
import type { ReactNode } from 'react';

export interface Translation {
  translation: string;
}

export interface LearningArticle {
  id: string;
  title: string;
  content: ReactNode;
}

export interface HistoryItem {
  id: string;
  imperativeText: string;
  translations: Translation[];
  tone?: string;
  interest?: string;
  useFewerWords?: boolean;
}