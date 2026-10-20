import rawFlipCardsData from '../constants/flipCards.json' with { type: 'json' };
import { CATEGORY_METADATA, type DemandCategory } from './demandRadar.ts';

export interface FlipCardData {
  id: string;
  category: string;
  before: string;
  beforeSignals: string[];
  after: string;
  whyItWorks: string;
  demandBefore: number;
  demandAfter: number;
}

export interface FlipCardCategoryChip {
  name: string;
  count: number;
}

export interface FlipDeckState {
  allCards: FlipCardData[];
  activeCategory: string;
  filteredCards: FlipCardData[];
  currentIndex: number;
  isFlipped: boolean;
}

export interface FlipCardViewModel {
  currentCard: FlipCardData | null;
  categories: FlipCardCategoryChip[];
  progressText: string;
  motionMode: 'fade' | '3d';
  dataFlipped: 'true' | 'false';
  cardAriaPressed: boolean;
  cardAriaLabel: string;
  frontFaceAriaHidden: boolean;
  backFaceAriaHidden: boolean;
  liveAnnouncement: string;
}

export const ALL_FLIP_CATEGORIES = 'All';

const PREFERRED_CATEGORY_ORDER = [
  'Mornings',
  'Mealtimes',
  'Bedtime',
  'School & Chores',
  'Screens & Transitions',
  'Siblings & Big Feelings',
];

const REQUIRED_STRING_FIELDS: Array<keyof Pick<FlipCardData, 'id' | 'category' | 'before' | 'after' | 'whyItWorks'>> = [
  'id',
  'category',
  'before',
  'after',
  'whyItWorks',
];

/**
 * Validates raw card JSON records.
 * Logs a console warning and skips any card missing required fields or having a duplicate id.
 */
export function validateFlipCards(
  rawCards: unknown,
  warnFn: (message: string) => void = console.warn
): FlipCardData[] {
  if (!Array.isArray(rawCards)) {
    warnFn('[FlipCards] Expected card data to be an array; received non-array.');
    return [];
  }

  const validCards: FlipCardData[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawCards.length; i++) {
    const item = rawCards[i];
    if (!item || typeof item !== 'object') {
      warnFn(`[FlipCards] Skipping card at index ${i}: not an object.`);
      continue;
    }

    const record = item as Record<string, unknown>;
    const missingOrInvalid: string[] = [];

    for (const field of REQUIRED_STRING_FIELDS) {
      const val = record[field];
      if (typeof val !== 'string' || val.trim().length === 0) {
        missingOrInvalid.push(field);
      }
    }

    if (
      !Array.isArray(record.beforeSignals) ||
      record.beforeSignals.length === 0 ||
      !record.beforeSignals.every((sig) => typeof sig === 'string' && sig.trim().length > 0)
    ) {
      missingOrInvalid.push('beforeSignals');
    }

    if (typeof record.demandBefore !== 'number' || !Number.isFinite(record.demandBefore)) {
      missingOrInvalid.push('demandBefore');
    }

    if (typeof record.demandAfter !== 'number' || !Number.isFinite(record.demandAfter)) {
      missingOrInvalid.push('demandAfter');
    }

    if (missingOrInvalid.length > 0) {
      const label = typeof record.id === 'string' && record.id.trim() ? `"${record.id}"` : `at index ${i}`;
      warnFn(
        `[FlipCards] Skipping incomplete card ${label}: missing or invalid field(s): ${missingOrInvalid.join(', ')}.`
      );
      continue;
    }

    const id = (record.id as string).trim();
    if (seenIds.has(id)) {
      warnFn(`[FlipCards] Duplicate card id "${id}" at index ${i}; rendering only the first occurrence.`);
      continue;
    }

    seenIds.add(id);
    validCards.push({
      id,
      category: (record.category as string).trim(),
      before: (record.before as string).trim(),
      beforeSignals: (record.beforeSignals as string[]).map((s) => s.trim()),
      after: (record.after as string).trim(),
      whyItWorks: (record.whyItWorks as string).trim(),
      demandBefore: record.demandBefore as number,
      demandAfter: record.demandAfter as number,
    });
  }

  return validCards;
}

/**
 * Default validated starter deck loaded from constants/flipCards.json.
 */
export const DEFAULT_FLIP_CARDS: FlipCardData[] = validateFlipCards(rawFlipCardsData);

/**
 * Computes category filter chips with counts.
 * Uses a stable, predictable category order so chips never jump or scramble.
 * Empty categories (count === 0) never appear.
 */
export function getFlipCardCategories(cards: FlipCardData[]): FlipCardCategoryChip[] {
  if (cards.length === 0) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const card of cards) {
    const cat = card.category.trim();
    if (!cat) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const chips: FlipCardCategoryChip[] = [{ name: ALL_FLIP_CATEGORIES, count: cards.length }];

  // Sort categories stably according to PREFERRED_CATEGORY_ORDER first, then alphabetical
  const sortedCategoryNames = Array.from(counts.keys()).sort((a, b) => {
    const indexA = PREFERRED_CATEGORY_ORDER.indexOf(a);
    const indexB = PREFERRED_CATEGORY_ORDER.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });

  for (const name of sortedCategoryNames) {
    const count = counts.get(name) ?? 0;
    if (count > 0) {
      chips.push({ name, count });
    }
  }

  return chips;
}

/**
 * Filters cards by category ('All' returns all cards).
 */
export function filterFlipCards(cards: FlipCardData[], category: string): FlipCardData[] {
  if (!category || category === ALL_FLIP_CATEGORIES) {
    return cards;
  }
  return cards.filter((card) => card.category === category);
}

/**
 * Fisher-Yates shuffle returning a new reordered array.
 * Guarantees order changes when there are 2+ distinct cards.
 */
export function shuffleFlipCards(
  cards: FlipCardData[],
  rng: () => number = Math.random
): FlipCardData[] {
  if (cards.length <= 1) {
    return [...cards];
  }

  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }

  const isIdenticalOrder = copy.every((card, index) => card.id === cards[index].id);
  if (isIdenticalOrder && copy.length >= 2) {
    const first = copy.shift()!;
    copy.push(first);
  }

  return copy;
}

/**
 * Resolves a signal key to Demand Radar taxonomy metadata if available,
 * or falls back to a calm plain-text label.
 */
export function resolveSignalChipMeta(signalKey: string): {
  key: string;
  label: string;
  isKnownCategory: boolean;
  category?: DemandCategory;
} {
  const normalized = signalKey.trim().toLowerCase() as DemandCategory;
  if (normalized in CATEGORY_METADATA) {
    const shortLabels: Record<DemandCategory, string> = {
      imperative: 'Imperative',
      urgency: 'Urgency',
      negative: 'Negative framing',
      threat: 'Ultimatum',
      rhetorical: 'Pressure question',
      absolute: 'Absolute',
    };
    return {
      key: normalized,
      label: shortLabels[normalized] || CATEGORY_METADATA[normalized].name,
      isKnownCategory: true,
      category: normalized,
    };
  }

  return {
    key: signalKey,
    label: signalKey,
    isKnownCategory: false,
  };
}

/**
 * Pure state machine helpers for the Flip Cards deck.
 */
export function createFlipDeckState(
  rawCards: unknown = rawFlipCardsData,
  warnFn: (message: string) => void = console.warn
): FlipDeckState {
  const allCards = validateFlipCards(rawCards, warnFn);
  return {
    allCards,
    activeCategory: ALL_FLIP_CATEGORIES,
    filteredCards: allCards,
    currentIndex: 0,
    isFlipped: false,
  };
}

export function flipCurrentCard(state: FlipDeckState): FlipDeckState {
  if (state.filteredCards.length === 0) return state;
  return {
    ...state,
    isFlipped: !state.isFlipped,
  };
}

export function nextFlipCard(state: FlipDeckState): FlipDeckState {
  const total = state.filteredCards.length;
  if (total === 0) return state;
  return {
    ...state,
    currentIndex: (state.currentIndex + 1) % total,
    isFlipped: false,
  };
}

export function prevFlipCard(state: FlipDeckState): FlipDeckState {
  const total = state.filteredCards.length;
  if (total === 0) return state;
  return {
    ...state,
    currentIndex: (state.currentIndex - 1 + total) % total,
    isFlipped: false,
  };
}

export function selectFlipCategory(state: FlipDeckState, category: string): FlipDeckState {
  const validCategories = getFlipCardCategories(state.allCards);
  const exists = validCategories.some((c) => c.name === category);
  const nextCategory = exists ? category : ALL_FLIP_CATEGORIES;
  const filteredCards = filterFlipCards(state.allCards, nextCategory);

  return {
    ...state,
    activeCategory: nextCategory,
    filteredCards,
    currentIndex: 0,
    isFlipped: false,
  };
}

/**
 * Shuffles the deck.
 * - Preserves the active category filter (does not switch categories).
 * - Preserves the stable ordering of category filter chips.
 * - Guarantees that the currently active card immediately changes to a different card
 *   whenever there are 2 or more cards in the current filtered set.
 */
export function shuffleFlipDeck(
  state: FlipDeckState,
  rng: () => number = Math.random
): FlipDeckState {
  const currentCardId = state.filteredCards[state.currentIndex]?.id;

  // 1. Shuffle the current filtered cards
  let filteredCards = shuffleFlipCards(state.filteredCards, rng);

  // 2. Guarantee that the active card (at index 0) changes if there are >= 2 cards
  if (filteredCards.length >= 2 && filteredCards[0].id === currentCardId) {
    const swapIdx = 1 + Math.floor(rng() * (filteredCards.length - 1));
    const temp = filteredCards[0];
    filteredCards[0] = filteredCards[swapIdx];
    filteredCards[swapIdx] = temp;
  }

  // 3. Keep allCards in sync without changing the active category filter
  const filteredIdSet = new Set(filteredCards.map((c) => c.id));
  const otherCards = shuffleFlipCards(
    state.allCards.filter((c) => !filteredIdSet.has(c.id)),
    rng
  );

  const allCards =
    state.activeCategory === ALL_FLIP_CATEGORIES
      ? filteredCards
      : [...filteredCards, ...otherCards];

  return {
    ...state,
    allCards,
    filteredCards,
    currentIndex: 0,
    isFlipped: false,
  };
}

export function getFlipProgressText(state: FlipDeckState): string {
  const total = state.filteredCards.length;
  if (total === 0) return 'Card 0 of 0';
  return `Card ${state.currentIndex + 1} of ${total}`;
}

export function shouldFlipOnKey(key: string): boolean {
  return key === 'Enter' || key === ' ' || key === 'Spacebar';
}

export function getFlipAnimationMode(prefersReducedMotion: boolean): 'fade' | '3d' {
  return prefersReducedMotion ? 'fade' : '3d';
}

export function getFlipCardViewModel(
  state: FlipDeckState,
  prefersReducedMotion: boolean = false
): FlipCardViewModel {
  const categories = getFlipCardCategories(state.allCards);
  const currentCard = state.filteredCards[state.currentIndex] ?? null;
  const progressText = getFlipProgressText(state);
  const motionMode = getFlipAnimationMode(prefersReducedMotion);

  const liveAnnouncement = currentCard
    ? state.isFlipped
      ? `After (A declarative try): "${currentCard.after}". Why this works: ${currentCard.whyItWorks}. Demand score drops from ${currentCard.demandBefore} to ${currentCard.demandAfter}.`
      : `Before (What we all say): "${currentCard.before}". Category: ${currentCard.category}.`
    : '';

  return {
    currentCard,
    categories,
    progressText,
    motionMode,
    dataFlipped: state.isFlipped ? 'true' : 'false',
    cardAriaPressed: state.isFlipped,
    cardAriaLabel: `Flip card (${progressText}): Currently showing ${
      state.isFlipped ? 'After — a declarative try' : 'Before — what we all say'
    }. Press Enter or Space to flip.`,
    frontFaceAriaHidden: state.isFlipped,
    backFaceAriaHidden: !state.isFlipped,
    liveAnnouncement,
  };
}
