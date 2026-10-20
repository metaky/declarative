import React, { useState, useEffect, useRef } from 'react';
import rawFlipCardsData from '../constants/flipCards.json' with { type: 'json' };
import {
  createFlipDeckState,
  flipCurrentCard,
  nextFlipCard,
  prevFlipCard,
  selectFlipCategory,
  shuffleFlipDeck,
  resolveSignalChipMeta,
  shouldFlipOnKey,
  getFlipCardViewModel,
  type FlipDeckState,
} from '../services/flipCards.ts';
import { CategoryIcon, CalmCheckIcon } from './DemandRadarIcons.tsx';

export interface BeforeAfterFlipCardsProps {
  cards?: unknown;
  forceReducedMotion?: boolean;
  className?: string;
}

export const BeforeAfterFlipCards: React.FC<BeforeAfterFlipCardsProps> = ({
  cards = rawFlipCardsData,
  forceReducedMotion,
  className = '',
}) => {
  const [deckState, setDeckState] = useState<FlipDeckState>(() => createFlipDeckState(cards));
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof forceReducedMotion === 'boolean') return forceReducedMotion;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeHandledRef = useRef<boolean>(false);

  // Re-validate and reset deck if external `cards` prop changes
  useEffect(() => {
    setDeckState(createFlipDeckState(cards));
  }, [cards]);

  // Listen for OS/browser reduced-motion changes
  useEffect(() => {
    if (typeof forceReducedMotion === 'boolean') {
      setPrefersReducedMotion(forceReducedMotion);
      return;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [forceReducedMotion]);

  const viewModel = getFlipCardViewModel(deckState, prefersReducedMotion);
  const { currentCard, categories, progressText, motionMode } = viewModel;

  if (!currentCard) {
    return null;
  }

  const handleCardFlip = () => {
    if (swipeHandledRef.current) {
      swipeHandledRef.current = false;
      return;
    }
    setDeckState((prev) => flipCurrentCard(prev));
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (shouldFlipOnKey(event.key)) {
      event.preventDefault();
      setDeckState((prev) => flipCurrentCard(prev));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setDeckState((prev) => nextFlipCard(prev));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setDeckState((prev) => prevFlipCard(prev));
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    touchStartRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
    swipeHandledRef.current = false;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartRef.current || event.changedTouches.length !== 1) return;
    const dx = event.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = event.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swipeHandledRef.current = true;
      if (dx < 0) {
        setDeckState((prev) => nextFlipCard(prev));
      } else {
        setDeckState((prev) => prevFlipCard(prev));
      }
    }
  };

  return (
    <section
      className={`w-full pt-8 mt-8 border-t border-gray-100 ${className}`}
      aria-label="Before and After Declarative Language Flip Cards"
    >
      {/* Section Header */}
      <div className="text-center max-w-xl mx-auto mb-6 space-y-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 text-sky-800 border border-sky-200/80">
          Interactive Practice Deck
        </span>
        <h4 className="text-xl md:text-2xl font-bold text-gray-900">
          See the Shift in Everyday Moments
        </h4>
        <p className="text-sm md:text-base text-gray-600 leading-relaxed">
          Tap any card to flip from what we all say in the heat of the moment to a low-pressure declarative try.
        </p>
      </div>

      {/* Category Filter Chips */}
      {categories.length > 1 && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 mb-6"
          role="group"
          aria-label="Filter flip cards by everyday moment"
        >
          {categories.map((chip) => {
            const isSelected = deckState.activeCategory === chip.name;
            return (
              <button
                key={chip.name}
                type="button"
                onClick={() => setDeckState((prev) => selectFlipCategory(prev, chip.name))}
                aria-pressed={isSelected}
                data-category-chip={chip.name}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  isSelected
                    ? 'bg-sky-700 text-white shadow-xs border border-sky-700'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800'
                }`}
              >
                <span>{chip.name}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-sky-800/80 text-sky-100'
                      : 'bg-gray-200/80 text-gray-600'
                  }`}
                >
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Screen-reader live announcement for newly revealed face */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="flip-live-region">
        {viewModel.liveAnnouncement}
      </div>

      {/* Centered Card Column (~560px comfortable max-width) */}
      <div className="w-full max-w-[560px] mx-auto">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={viewModel.cardAriaPressed}
          aria-label={viewModel.cardAriaLabel}
          onClick={handleCardFlip}
          onKeyDown={handleCardKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          data-testid="flip-card-interactive"
          className="flip-card-perspective w-full h-[360px] sm:h-[320px] cursor-pointer select-none rounded-2xl focus:outline-none focus-visible:ring-3 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        >
          <div
            className="flip-card-inner h-full"
            data-flipped={viewModel.dataFlipped}
            data-motion={motionMode}
            data-testid="flip-card-inner"
          >
            {/* FRONT FACE ("Before") */}
            <div
              className="flip-card-face flip-card-face-front h-full rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/45 via-white to-amber-50/30 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              aria-hidden={viewModel.frontFaceAriaHidden}
              data-testid="flip-card-front"
            >
              {/* Top Row: Framing Label + Category */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-amber-100/80 text-amber-900 border border-amber-200/80">
                  <span>Before • What we all say</span>
                </span>
                <span className="text-xs font-medium text-gray-500 bg-white/90 px-2.5 py-1 rounded-full border border-gray-200/80">
                  {currentCard.category}
                </span>
              </div>

              {/* Center Quote: Demanding Phrase */}
              <div className="flex-1 flex flex-col justify-center my-auto py-2 overflow-y-auto no-scrollbar">
                <p
                  className="text-xl sm:text-2xl md:text-[1.6rem] font-bold text-gray-800 leading-snug break-words"
                  data-testid="flip-card-before-text"
                >
                  &ldquo;{currentCard.before}&rdquo;
                </p>

                {/* Demand Signal Chips */}
                {currentCard.beforeSignals.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 sm:mt-4" aria-label="Demand signals present">
                    <span className="text-xs text-gray-500 mr-1">Signals:</span>
                    {currentCard.beforeSignals.map((sig) => {
                      const chip = resolveSignalChipMeta(sig);
                      return (
                        <span
                          key={sig}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200/90"
                        >
                          {chip.isKnownCategory && chip.category && (
                            <CategoryIcon category={chip.category} className="w-3 h-3 text-amber-700 shrink-0" />
                          )}
                          <span>{chip.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Hint */}
              <div className="pt-2 sm:pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs font-medium text-gray-500 shrink-0">
                <span>Demand score: {currentCard.demandBefore}</span>
                <span className="inline-flex items-center gap-1 text-sky-700 font-semibold">
                  <span>Tap to see a declarative try</span>
                  <span aria-hidden="true">↻</span>
                </span>
              </div>
            </div>

            {/* BACK FACE ("After") */}
            <div
              className="flip-card-face flip-card-face-back h-full rounded-2xl border border-emerald-200/90 bg-gradient-to-b from-emerald-50/55 via-white to-teal-50/35 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between overflow-hidden"
              aria-hidden={viewModel.backFaceAriaHidden}
              data-testid="flip-card-back"
            >
              {/* Top Row: Framing Label + Demand Score Reduction */}
              <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                  <CalmCheckIcon className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>After • A declarative try</span>
                </span>
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80"
                  data-testid="flip-card-demand-delta"
                >
                  <span>
                    Demand: {currentCard.demandBefore} → {currentCard.demandAfter}
                  </span>
                </span>
              </div>

              {/* Center Quote: Declarative Rewrite + Why It Works */}
              <div className="flex-1 flex flex-col justify-center my-auto py-2 space-y-2.5 sm:space-y-3 overflow-y-auto no-scrollbar">
                <p
                  className="text-xl sm:text-2xl md:text-[1.6rem] font-bold text-emerald-950 leading-snug break-words"
                  data-testid="flip-card-after-text"
                >
                  &ldquo;{currentCard.after}&rdquo;
                </p>

                <div className="rounded-xl bg-white/90 border border-emerald-200/80 p-3 sm:p-3.5 text-xs sm:text-sm text-gray-700 leading-relaxed break-words">
                  <span className="font-semibold text-emerald-900">Why this works: </span>
                  <span data-testid="flip-card-why-text">{currentCard.whyItWorks}</span>
                </div>
              </div>

              {/* Bottom Hint */}
              <div className="pt-2 sm:pt-3 border-t border-emerald-100/90 flex items-center justify-between text-xs font-medium text-gray-500 shrink-0">
                <span>{currentCard.category}</span>
                <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                  <span>Tap to flip back</span>
                  <span aria-hidden="true">↺</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Deck Navigation & Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeckState((prev) => prevFlipCard(prev))}
              disabled={deckState.filteredCards.length <= 1}
              aria-label="Previous card"
              data-testid="flip-prev-button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <span aria-hidden="true">←</span>
              <span>Prev</span>
            </button>

            <button
              type="button"
              onClick={() => setDeckState((prev) => nextFlipCard(prev))}
              disabled={deckState.filteredCards.length <= 1}
              aria-label="Next card"
              data-testid="flip-next-button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <span>Next</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div
            className="text-xs sm:text-sm font-semibold text-gray-600 tabular-nums"
            aria-live="polite"
            data-testid="flip-progress-indicator"
          >
            {progressText}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDeckState((prev) => flipCurrentCard(prev))}
              aria-label={deckState.isFlipped ? 'Show Before side' : 'Show After side'}
              data-testid="flip-toggle-button"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border border-gray-200 bg-gray-50 text-gray-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <span>{deckState.isFlipped ? 'Show Before' : 'Flip Card'}</span>
            </button>

            <button
              type="button"
              onClick={() => setDeckState((prev) => shuffleFlipDeck(prev))}
              disabled={deckState.filteredCards.length <= 1}
              aria-label="Shuffle deck"
              data-testid="flip-shuffle-button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-sky-200 bg-sky-50/70 text-sky-800 hover:bg-sky-100/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <span aria-hidden="true">⇄</span>
              <span>Shuffle</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
