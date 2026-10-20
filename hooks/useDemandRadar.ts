import { useState, useEffect, useMemo, useCallback } from 'react';
import type { DemandRadarResult, DemandSignal } from '../services/demandRadar';
import { scanDemand, calculateDemandScore, CATEGORY_METADATA } from '../services/demandRadar';

function mergeWithAiSignals(
  baseResult: DemandRadarResult,
  text: string,
  aiSignalsByText: Record<string, DemandSignal[]>,
  ignoredKeys: Set<string>
): DemandRadarResult {
  const trimmed = text.trim();
  const extraAiSignals = aiSignalsByText[trimmed] || [];

  if (extraAiSignals.length === 0 || baseResult.isEmpty || baseResult.isNonEnglish) {
    return baseResult;
  }

  const combined = [...baseResult.signals];
  for (const aiSig of extraAiSignals) {
    const ignoreKey = `${aiSig.category}:${aiSig.phrase.toLowerCase().trim()}`;
    if (ignoredKeys.has(ignoreKey)) continue;

    const overlapsExisting = combined.some(
      (existing) => Math.max(existing.start, aiSig.start) < Math.min(existing.end, aiSig.end)
    );
    if (!overlapsExisting) {
      combined.push({
        ...aiSig,
        note: aiSig.note || CATEGORY_METADATA[aiSig.category]?.defaultNote || '',
      });
    }
  }

  combined.sort((a, b) => a.start - b.start || b.end - a.end);
  const { score, label, tier } = calculateDemandScore(combined);

  return {
    ...baseResult,
    signals: combined,
    score,
    label,
    tier,
  };
}

export function useDemandRadar(
  inputText: string,
  submittedText: string = '',
  debounceMs: number = 300
) {
  const [debouncedText, setDebouncedText] = useState(inputText);
  const [ignoredKeys, setIgnoredKeys] = useState<Set<string>>(() => new Set());
  const [aiSignalsByText, setAiSignalsByText] = useState<Record<string, DemandSignal[]>>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedText(inputText);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputText, debounceMs]);

  useEffect(() => {
    if (!inputText.trim()) {
      setDebouncedText('');
    }
  }, [inputText]);

  const analyzeSubmittedText = useCallback(async (targetText: string) => {
    const trimmed = targetText.trim();
    if (!trimmed) return;

    // Only invoke the AI fallback when the deterministic syntactic engine found no flags
    // and the sentence does not already have positive declarative markers.
    const baseline = scanDemand(trimmed);
    if (baseline.signals.length > 0 || baseline.hasPositiveDeclarativeMarkers || baseline.isNonEnglish) {
      return;
    }

    setIsLoadingAI(true);
    try {
      const response = await fetch('/api/demand-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.signals) && data.signals.length > 0) {
          setAiSignalsByText((prev) => ({
            ...prev,
            [trimmed]: data.signals,
          }));
        }
      }
    } catch {
      // Fallback to syntactic engine silently
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  const liveRadarResult: DemandRadarResult = useMemo(() => {
    const base = scanDemand(debouncedText, ignoredKeys);
    return mergeWithAiSignals(base, debouncedText, aiSignalsByText, ignoredKeys);
  }, [debouncedText, ignoredKeys, aiSignalsByText]);

  const submittedRadarResult: DemandRadarResult = useMemo(() => {
    const activeSubmitted = submittedText || debouncedText;
    const base = scanDemand(activeSubmitted, ignoredKeys);
    return mergeWithAiSignals(base, activeSubmitted, aiSignalsByText, ignoredKeys);
  }, [submittedText, debouncedText, ignoredKeys, aiSignalsByText]);

  const ignoreSignal = useCallback((signal: DemandSignal) => {
    const key = `${signal.category}:${signal.phrase.toLowerCase().trim()}`;
    setIgnoredKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const clearIgnored = useCallback(() => {
    setIgnoredKeys(new Set());
  }, []);

  return {
    radarResult: submittedRadarResult,
    liveRadarResult,
    submittedRadarResult,
    debouncedText,
    ignoreSignal,
    clearIgnored,
    ignoredKeys,
    analyzeSubmittedText,
    isLoadingAI,
  };
}
