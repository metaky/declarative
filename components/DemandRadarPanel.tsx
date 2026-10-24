import React, { useState, useEffect, useRef } from 'react';
import type { DemandRadarResult, DemandSignal } from '../services/demandRadar';
import { CATEGORY_METADATA } from '../services/demandRadar';
import {
  RadarPulseIcon,
  CalmCheckIcon,
  IgnoreIcon,
  CategoryIcon,
} from './DemandRadarIcons';

interface DemandRadarPanelProps {
  result: DemandRadarResult;
  inputText: string;
  onIgnoreSignal: (signal: DemandSignal) => void;
  isLoadingAI?: boolean;
  className?: string;
}

export const DemandRadarPanel: React.FC<DemandRadarPanelProps> = ({
  result,
  inputText,
  onIgnoreSignal,
  isLoadingAI = false,
  className = '',
}) => {
  const [activeTooltipSignalId, setActiveTooltipSignalId] = useState<string | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const detailsDrawerId = 'demand-radar-details-drawer';

  // Reset open drawer and tooltips when a new statement is submitted so results stay compact
  useEffect(() => {
    setIsDetailsExpanded(false);
    setActiveTooltipSignalId(null);
  }, [inputText]);

  // Dismiss open tooltip on outside tap/click or Escape key
  useEffect(() => {
    if (!activeTooltipSignalId) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setActiveTooltipSignalId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveTooltipSignalId(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeTooltipSignalId]);

  if (result.isEmpty || !inputText.trim()) {
    return null;
  }

  if (result.isNonEnglish) {
    return (
      <div
        className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-600 flex items-center justify-between gap-3 animate-fade-in ${className}`}
        role="status"
      >
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <RadarPulseIcon className="w-4 h-4 text-slate-500" />
          <span>Demand Radar: English only for now</span>
        </div>
        <span className="text-xs text-slate-500">Translations below</span>
      </div>
    );
  }

  const getTierStyles = () => {
    switch (result.tier) {
      case 'gentle':
        return {
          badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          bar: 'bg-emerald-500',
          cardBorder: 'border-emerald-200/80 bg-emerald-50/20',
        };
      case 'firm':
        return {
          badge: 'bg-amber-50 text-amber-800 border-amber-200',
          bar: 'bg-amber-500',
          cardBorder: 'border-amber-200/80 bg-amber-50/20',
        };
      case 'demanding':
        return {
          badge: 'bg-orange-50 text-orange-800 border-orange-200',
          bar: 'bg-orange-500',
          cardBorder: 'border-orange-200/80 bg-orange-50/15',
        };
      case 'high_demand':
        return {
          badge: 'bg-rose-50 text-rose-800 border-rose-200',
          bar: 'bg-rose-600',
          cardBorder: 'border-rose-200/80 bg-rose-50/15',
        };
    }
  };

  const tierStyles = getTierStyles();

  // Deduplicate spans that share identical start/end (e.g. "Stop" -> Imperative + Negative)
  const renderShowcaseSentence = () => {
    const signals = result.signals;
    if (signals.length === 0) {
      return <span className="text-gray-700">&ldquo;{inputText}&rdquo;</span>;
    }

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    const sortedSignals = [...signals]
      .filter((s) => s.start >= 0 && s.end <= inputText.length && s.start < s.end)
      .sort((a, b) => a.start - b.start || b.end - a.end);

    for (let i = 0; i < sortedSignals.length; i++) {
      const sig = sortedSignals[i];

      const sameSpanSignals = sortedSignals.filter(
        (other) => other.start === sig.start && other.end === sig.end
      );

      if (sig.start > currentIndex) {
        elements.push(
          <span key={`text-${currentIndex}`} className="text-gray-700">
            {inputText.slice(currentIndex, sig.start)}
          </span>
        );
      }

      if (sig.start >= currentIndex) {
        const meta = CATEGORY_METADATA[sig.category] || CATEGORY_METADATA.imperative;
        const phrase = inputText.slice(sig.start, sig.end);
        const isTooltipOpen = activeTooltipSignalId === sig.id;
        const tooltipId = `radar-tooltip-${sig.id}`;
        // Anchor left-aligned when near the start of the sentence so mobile viewports never clip on the left edge
        const isNearSentenceStart = sig.start <= 12;

        elements.push(
          <span
            key={`highlight-${sig.id || i}`}
            className="relative inline-block mx-0.5 align-baseline"
            onMouseEnter={() => setActiveTooltipSignalId(sig.id)}
            onMouseLeave={() => setActiveTooltipSignalId(null)}
          >
            <button
              type="button"
              aria-describedby={tooltipId}
              aria-expanded={isTooltipOpen}
              onClick={() =>
                setActiveTooltipSignalId((current) => (current === sig.id ? null : sig.id))
              }
              onFocus={() => setActiveTooltipSignalId(sig.id)}
              onBlur={() => setActiveTooltipSignalId(null)}
              className={`ph-no-capture inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold text-sm md:text-base transition-all focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer ${meta.bgStyle} ${meta.underlineStyle}`}
            >
              <CategoryIcon category={sig.category} className="w-3.5 h-3.5 inline-block opacity-85 flex-shrink-0" />
              <span data-ph-mask="true">{phrase}</span>
            </button>

            {isTooltipOpen && (
              <div
                id={tooltipId}
                role="tooltip"
                className={`absolute ${
                  isNearSentenceStart ? 'left-0' : 'left-1/2 -translate-x-1/2'
                } bottom-full mb-2 z-30 w-64 sm:w-72 max-w-[calc(100vw-2.5rem)] p-3 bg-white/98 backdrop-blur-sm rounded-xl border border-gray-200 shadow-xl text-left text-xs text-gray-700 animate-fade-in`}
              >
                {sameSpanSignals.map((spanSig, idx) => {
                  const spanMeta = CATEGORY_METADATA[spanSig.category] || CATEGORY_METADATA.imperative;
                  return (
                    <div
                      key={spanSig.id}
                      className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-100' : ''}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 font-bold text-gray-900">
                          <CategoryIcon category={spanSig.category} className="w-3.5 h-3.5 text-sky-600" />
                          <span>{spanMeta.name}</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            spanSig.severity === 'strong'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {spanSig.severity === 'strong' ? 'Strong' : 'Mild'}
                        </span>
                      </div>
                      <p className="leading-relaxed text-gray-600 font-normal">{spanSig.note}</p>
                    </div>
                  );
                })}
                <div
                  className={`absolute ${
                    isNearSentenceStart ? 'left-6' : 'left-1/2 -translate-x-1/2'
                  } -bottom-1 w-2 h-2 bg-white border-b border-r border-gray-200 rotate-45`}
                />
              </div>
            )}
          </span>
        );

        currentIndex = sig.end;
      }
    }

    if (currentIndex < inputText.length) {
      elements.push(
        <span key="text-end" className="text-gray-700">
          {inputText.slice(currentIndex)}
        </span>
      );
    }

    return elements;
  };

  return (
    <div
      ref={panelRef}
      className={`w-full rounded-2xl border bg-white p-4 md:px-5 md:py-4 shadow-subtle transition-all duration-300 animate-fade-in ${tierStyles.cardBorder} ${className}`}
      aria-label="Demand Radar analysis"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-grow min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-sky-700">
              <RadarPulseIcon className="w-3.5 h-3.5" />
              <span>Demand Radar</span>
            </span>

            {result.signals.length > 0 || result.hasPositiveDeclarativeMarkers ? (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold ${tierStyles.badge}`}
              >
                <span>{result.score}</span>
                <span className="opacity-60">•</span>
                <span>{result.label}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold">
                <span>Subtle / Unscored</span>
              </span>
            )}

            {isLoadingAI && (
              <span className="text-[11px] text-gray-400 italic" role="status" aria-live="polite">
                Scanning nuances...
              </span>
            )}

            {result.signals.length > 0 && (
              <span className="text-[11px] text-gray-400 hidden sm:inline">
                • Tap highlighted words for PDA notes
              </span>
            )}
          </div>

          <div className="ph-no-capture text-sm md:text-base leading-relaxed break-words" data-ph-mask="true">
            {renderShowcaseSentence()}
          </div>
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 flex-shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-gray-100">
          {result.signals.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsDetailsExpanded((prev) => !prev)}
              aria-expanded={isDetailsExpanded}
              aria-controls={detailsDrawerId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-gray-50 text-gray-700 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <span>
                {isDetailsExpanded
                  ? 'Hide why this lands hard'
                  : `Why this lands hard (${result.signals.length})`}
              </span>
              <span className="text-[10px]" aria-hidden="true">
                {isDetailsExpanded ? '▴' : '▾'}
              </span>
            </button>
          ) : result.hasPositiveDeclarativeMarkers ? (
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CalmCheckIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>All clear — nothing demanding detected.</span>
            </div>
          ) : (
            <div className="text-xs text-gray-500">
              No direct command words flagged — softer declarative ideas below.
            </div>
          )}
        </div>
      </div>

      {isDetailsExpanded && result.signals.length > 0 && (
        <div
          id={detailsDrawerId}
          className="mt-3.5 pt-3.5 border-t border-gray-200/70 space-y-2 animate-fade-in"
        >
          {result.signals.map((sig) => {
            const meta = CATEGORY_METADATA[sig.category] || CATEGORY_METADATA.imperative;

            return (
              <div
                key={sig.id}
                className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ph-no-capture font-bold text-gray-900 text-xs md:text-sm" data-ph-mask="true">
                      &ldquo;{sig.phrase}&rdquo;
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badgeStyle}`}
                    >
                      <CategoryIcon category={sig.category} className="w-3 h-3" />
                      <span>{meta.name}</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        sig.severity === 'strong'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {sig.severity === 'strong' ? 'Strong demand' : 'Mild pressure'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{sig.note}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onIgnoreSignal(sig)}
                  className="ph-no-capture self-end sm:self-center inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-white border border-transparent hover:border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 flex-shrink-0"
                  aria-label="Ignore this flag for this session"
                >
                  <IgnoreIcon className="w-3 h-3" />
                  <span>Ignore</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
