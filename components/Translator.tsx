import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getDeclarativeTranslations } from '../services/geminiService';
import { trackEvent } from '../services/analytics';
import { cloneTranslations, cloneVariationCache, countSavedVariationSets, createEntityId } from '../services/translationUtils';
import type { HistoryEntryInput, HistoryItem, Translation, VariationCache, VariationKind, VariationHistoryMap } from '../types';
import { CopyIcon, CheckIcon, SpeechBubbleIcon, AlignLeftIcon, LaughingFaceIcon, BalanceScaleIcon, StarIcon, HistoryIcon, TrashIcon, CloseIcon, ShareIcon, QuestionMarkCircleIcon } from './icons/Icons';
import { DonationCallout } from './DonationCallout';

interface TranslatorProps {
  history: HistoryItem[];
  onHistorySave: (entry: HistoryEntryInput) => void;
  onClearHistory: () => void;
}

interface VariationPanelState {
  selectedKind?: VariationKind;
  displayKind?: VariationKind;
  pendingKind?: VariationKind;
  isLoading: boolean;
  error: string | null;
}

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, label = 'Copy to clipboard', className = '' }) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${className}`}
      aria-label={label}
      type="button"
    >
      {hasCopied ? <CheckIcon className="w-5 h-5 text-green-600" /> : <CopyIcon className="w-5 h-5" />}
    </button>
  );
};

const examplePrompts = [
  {
    label: 'Get ready for school',
    inputText: 'Get your backpack and get your shoes on so we can get ready for school',
  },
  {
    label: "It's time for dinner",
    inputText: "Please come down and wash your hands. It's dinner time.",
  },
  {
    label: 'No more yelling',
    inputText: 'You are being way too loud right now. Please stop.',
  },
  {
    label: 'Do your homework',
    inputText: 'You have a lot of homework tonight, so we need to get started now',
  },
];

const TONE_OPTIONS = [
  {
    name: 'Default',
    Icon: SpeechBubbleIcon,
    iconClassName: 'text-gray-500',
    description: '',
  },
  {
    name: 'Straightforward',
    Icon: AlignLeftIcon,
    iconClassName: 'text-slate-500',
    description: 'Short, clear, and low-pressure phrasing that gets to the point without sounding bossy, playful, or overexplained.',
  },
  {
    name: 'Humorous',
    Icon: LaughingFaceIcon,
    iconClassName: 'text-amber-500',
    description: 'Humor surprises the brain and breaks through anxiety, lowering defenses and making the interaction feel safe and fun.',
  },
  {
    name: 'Equalizing',
    Icon: BalanceScaleIcon,
    iconClassName: 'text-teal-500',
    description: 'Making the child feel more powerful or capable than the adult reduces the threat of authority, helping them feel safe enough to move forward.',
  },
  {
    name: 'Interest Based',
    Icon: StarIcon,
    iconClassName: 'text-indigo-500',
    description: 'Connecting through their passions creates immediate safety and joy, significantly lowering the PDA threat response to everyday transitions.',
  },
];

const LOADING_MESSAGES = [
  'Forming recommendations. This only takes a few seconds...',
  "Translating your statement. Deep breath, you're almost there.",
  'Analyzing the demand. Hang tight, help is on the way.',
  'Crafting connecting ideas. Just a moment...',
  "Reframing the request. You're doing a great job.",
  'Generating gentle alternatives. Take a slow breath...',
  'Preparing declarative options. Almost done...',
  'Gathering suggestions. This will just be a few seconds.',
];

const VARIATION_LABELS: Record<VariationKind, string> = {
  shorter: 'Shorter',
  longer: 'Longer',
  warmer: 'Warmer',
  more_straightforward: 'More straightforward',
  more_playful: 'More playful',
};

const VARIATION_ORDER_DEFAULT: VariationKind[] = ['shorter', 'warmer', 'more_straightforward', 'more_playful'];
const VARIATION_ORDER_FEWER_WORDS: VariationKind[] = ['longer', 'warmer', 'more_straightforward', 'more_playful'];

const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatHistoryTimestamp = (createdAt: string) => historyDateFormatter.format(new Date(createdAt));

const getVariationKinds = (useFewerWords: boolean) => (
  useFewerWords ? VARIATION_ORDER_FEWER_WORDS : VARIATION_ORDER_DEFAULT
);

interface TranslationItemProps {
  item: Translation;
  isOpen: boolean;
  onToggleOpen: () => void;
  variationKinds: VariationKind[];
  variationCache: VariationCache;
  variationState?: VariationPanelState;
  onVariationSelect: (item: Translation, kind: VariationKind) => void;
}

const TranslationItem: React.FC<TranslationItemProps> = ({
  item,
  isOpen,
  onToggleOpen,
  variationKinds,
  variationCache,
  variationState,
  onVariationSelect,
}) => {
  const variationPanelId = `variation-panel-${item.id}`;
  const hasVariationResults = variationState?.displayKind
    ? Boolean(variationCache[variationState.displayKind]?.length)
    : false;
  const activeResults = variationState?.displayKind
    ? variationCache[variationState.displayKind] || []
    : [];
  const isShowingPreviousResults = Boolean(
    variationState?.isLoading &&
    variationState?.displayKind &&
    variationState?.selectedKind &&
    variationState.displayKind !== variationState.selectedKind
  );

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-subtle transition-all duration-300">
      <div className="flex justify-between items-start space-x-4">
        <p className="flex-grow text-lg text-gray-700 leading-relaxed">{item.translation}</p>
        <div className="flex-shrink-0 flex items-center space-x-2">
          <CopyButton text={item.translation} className="w-10 h-10" />
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={isOpen}
          aria-controls={variationPanelId}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${isOpen ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
        >
          {isOpen ? 'Hide variations' : 'Try a variation'}
        </button>
      </div>

      {isOpen && (
        <div
          id={variationPanelId}
          className="mt-4 pt-4 border-t border-sky-100 animate-fade-in"
        >
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-900">Refine this version</span>
            <span className="text-xs text-gray-500">Try a quick rewrite without starting over.</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {variationKinds.map((kind) => {
              const isSelected = variationState?.selectedKind === kind;
              const isCached = Boolean(variationCache[kind]?.length);

              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => onVariationSelect(item, kind)}
                  aria-pressed={isSelected}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${isSelected ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700'}`}
                >
                  {isSelected && <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">✓</span>}
                  <span>{VARIATION_LABELS[kind]}</span>
                  {isCached && !isSelected && <span className="text-[11px] text-sky-600">Saved</span>}
                </button>
              );
            })}
          </div>

          {variationState?.isLoading && (
            <div
              className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-500"
              role="status"
              aria-live="polite"
            >
              <svg className="animate-spin h-4 w-4 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>
                {variationState.selectedKind
                  ? `Trying a ${VARIATION_LABELS[variationState.selectedKind].toLowerCase()} pass.`
                  : 'Trying a new pass.'}
              </span>
              {isShowingPreviousResults && <span className="rounded-full bg-amber-50 px-2 py-1 font-medium text-amber-700">Updating results</span>}
            </div>
          )}

          {variationState?.error && (
            <div
              className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              role="alert"
            >
              {variationState.error}
            </div>
          )}

          {!variationState?.isLoading && !variationState?.error && !hasVariationResults && (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
              Pick a version to explore. Saved variation results for this card will appear here.
            </div>
          )}

          {hasVariationResults && (
            <div className={`mt-4 space-y-3 transition-opacity ${isShowingPreviousResults ? 'opacity-70' : 'opacity-100'}`}>
              {activeResults.map((variation) => (
                <div key={variation.id} className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex-grow text-base text-slate-700 leading-relaxed">{variation.translation}</p>
                    <CopyButton
                      text={variation.translation}
                      label="Copy variation"
                      className="w-9 h-9"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Translator: React.FC<TranslatorProps> = ({ history, onHistorySave, onClearHistory }) => {
  const [inputValue, setInputValue] = useState('');
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState(TONE_OPTIONS[0].name);
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [openToneHelp, setOpenToneHelp] = useState<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [variationCache, setVariationCache] = useState<VariationHistoryMap>({});
  const [variationStates, setVariationStates] = useState<Record<string, VariationPanelState>>({});
  const [openVariationSourceId, setOpenVariationSourceId] = useState<string | null>(null);

  const [interest, setInterest] = useState(() => {
    try {
      return localStorage.getItem('savedInterest') || '';
    } catch (e) {
      return '';
    }
  });

  const [useFewerWords, setUseFewerWords] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const shouldScrollToResults = useRef(false);
  const toneSectionRef = useRef<HTMLDivElement>(null);
  const toneHelpPointerIntentRef = useRef(false);
  const activeVariationRequestRef = useRef<{
    controller: AbortController | null;
    requestId: number;
    sourceId: string | null;
    variationKind: VariationKind | null;
  }>({
    controller: null,
    requestId: 0,
    sourceId: null,
    variationKind: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem('savedInterest', interest);
    } catch (e) {
      // Ignore errors
    }
  }, [interest]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateSupportsHover = () => setSupportsHover(mediaQuery.matches);

    updateSupportsHover();
    mediaQuery.addEventListener('change', updateSupportsHover);

    return () => {
      mediaQuery.removeEventListener('change', updateSupportsHover);
    };
  }, []);

  useEffect(() => {
    if (!isLoading && translations.length > 0 && shouldScrollToResults.current) {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        shouldScrollToResults.current = false;
      }
    }
  }, [translations, isLoading]);

  useEffect(() => {
    const handlePointerDownOutsideToneHelp = (event: PointerEvent) => {
      if (!toneSectionRef.current?.contains(event.target as Node)) {
        setOpenToneHelp(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenToneHelp(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutsideToneHelp);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutsideToneHelp);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      activeVariationRequestRef.current.controller?.abort();
    };
  }, []);

  const cancelActiveVariationRequest = useCallback((trackAbort: boolean) => {
    const activeRequest = activeVariationRequestRef.current;
    if (activeRequest.controller) {
      activeRequest.controller.abort();
      if (trackAbort) {
        trackEvent('variation_request_aborted', {
          mode: 'variation',
          variation_kind: activeRequest.variationKind,
          source_translation_id: activeRequest.sourceId,
          aborted: true,
        });
      }
    }

    activeVariationRequestRef.current = {
      controller: null,
      requestId: activeRequest.requestId,
      sourceId: null,
      variationKind: null,
    };
  }, []);

  const resetVariationUi = useCallback((clearCache: boolean) => {
    cancelActiveVariationRequest(false);
    setOpenVariationSourceId(null);
    setVariationStates({});
    if (clearCache) {
      setVariationCache({});
    }
  }, [cancelActiveVariationRequest]);

  const getCurrentRequestText = useCallback(() => inputValue.trim(), [inputValue]);

  const handleToneSelect = useCallback((toneName: string) => {
    setTone(toneName);
    setOpenToneHelp(null);
    resetVariationUi(false);
  }, [resetVariationUi]);

  const handleToneHelpToggle = useCallback((toneName: string) => {
    setOpenToneHelp(current => current === toneName ? null : toneName);
  }, []);

  const handleToneHelpBlur = useCallback((event: React.FocusEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
      setOpenToneHelp(null);
    }
  }, []);

  const saveRunState = useCallback((runId: string, nextTranslations: Translation[], nextVariationUpdate?: HistoryEntryInput['variationUpdate']) => {
    const currentInterest = tone === 'Interest Based' ? interest : undefined;
    onHistorySave({
      runId,
      imperativeText: getCurrentRequestText(),
      translations: cloneTranslations(nextTranslations),
      tone,
      interest: currentInterest,
      useFewerWords,
      variationUpdate: nextVariationUpdate,
    });
  }, [getCurrentRequestText, interest, onHistorySave, tone, useFewerWords]);

  const handleTranslate = useCallback(async () => {
    if (!getCurrentRequestText() || isLoading) return;

    const requestText = getCurrentRequestText();
    const nextRunId = createEntityId('history');
    setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    setIsLoading(true);
    setError(null);
    setTranslations([]);
    resetVariationUi(true);
    shouldScrollToResults.current = true;

    try {
      const currentInterest = tone === 'Interest Based' ? interest : undefined;
      const results = await getDeclarativeTranslations({
        imperativeText: requestText,
        mode: 'translate',
        existingTranslations: [],
        tone,
        interest: currentInterest,
        useFewerWords,
      });
      setTranslations(results);
      setCurrentRunId(nextRunId);
      saveRunState(nextRunId, results);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getCurrentRequestText, interest, isLoading, resetVariationUi, saveRunState, tone, useFewerWords]);

  const handleGenerateMore = useCallback(async () => {
    if (!getCurrentRequestText() || isGeneratingMore || !currentRunId) return;

    const requestText = getCurrentRequestText();
    setIsGeneratingMore(true);
    setError(null);

    try {
      const currentInterest = tone === 'Interest Based' ? interest : undefined;
      const results = await getDeclarativeTranslations({
        imperativeText: requestText,
        mode: 'moreIdeas',
        existingTranslations: translations,
        tone,
        interest: currentInterest,
        useFewerWords,
      });
      const combinedTranslations = [...translations, ...results];
      setTranslations(combinedTranslations);
      saveRunState(currentRunId, combinedTranslations);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsGeneratingMore(false);
    }
  }, [currentRunId, getCurrentRequestText, interest, isGeneratingMore, saveRunState, tone, translations, useFewerWords]);

  const handleShareTool = async () => {
    const shareData = {
      title: 'Declarative Language Tool',
      text: 'Check out this Declarative Language translator for PDA and neurodivergent communication!',
      url: 'https://declarativeapp.org',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.debug('Share cancelled', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        setHasCopiedShareLink(true);
        setTimeout(() => setHasCopiedShareLink(false), 3000);
      } catch (err) {
        console.error('Failed to copy link', err);
      }
    }
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setInputValue(item.imperativeText);
    setTranslations(cloneTranslations(item.translations));
    setTone(item.tone || TONE_OPTIONS[0].name);
    setInterest(item.interest || '');
    setUseFewerWords(item.useFewerWords || false);
    setCurrentRunId(item.id);
    setVariationCache(cloneVariationCache(item.variations));
    setVariationStates({});
    setOpenVariationSourceId(null);
    setError(null);
    setIsLoading(false);
    setIsGeneratingMore(false);
    cancelActiveVariationRequest(false);
    setIsHistoryModalOpen(false);
    shouldScrollToResults.current = true;
  };

  const handleConfirmClearHistory = () => {
    onClearHistory();
    setShowClearConfirm(false);
    setIsHistoryModalOpen(false);
  };

  const handleToggleVariationPanel = useCallback((sourceId: string) => {
    setError(null);
    setOpenVariationSourceId((current) => {
      if (current === sourceId) {
        if (activeVariationRequestRef.current.sourceId === sourceId) {
          cancelActiveVariationRequest(true);
          setVariationStates((previous) => ({
            ...previous,
            [sourceId]: {
              ...(previous[sourceId] || { isLoading: false, error: null }),
              isLoading: false,
              pendingKind: undefined,
              error: null,
            },
          }));
        }
        return null;
      }

      if (current && current !== sourceId && activeVariationRequestRef.current.sourceId === current) {
        cancelActiveVariationRequest(true);
        setVariationStates((previous) => ({
          ...previous,
          [current]: {
            ...(previous[current] || { isLoading: false, error: null }),
            isLoading: false,
            pendingKind: undefined,
          },
        }));
      }

      return sourceId;
    });
  }, [cancelActiveVariationRequest]);

  const handleVariationSelect = useCallback(async (item: Translation, variationKind: VariationKind) => {
    if (!currentRunId || !getCurrentRequestText()) return;

    setOpenVariationSourceId(item.id);
    const currentVariationCache = variationCache[item.id] || {};
    const cachedResults = currentVariationCache[variationKind];

    if (cachedResults && cachedResults.length > 0) {
      if (activeVariationRequestRef.current.controller) {
        cancelActiveVariationRequest(true);
      }
      setVariationStates((previous) => ({
        ...previous,
        [item.id]: {
          selectedKind: variationKind,
          displayKind: variationKind,
          pendingKind: undefined,
          isLoading: false,
          error: null,
        },
      }));
      trackEvent('variation_cache_hit', {
        mode: 'variation',
        cache_hit: true,
        variation_kind: variationKind,
        source_translation_id: item.id,
      });
      return;
    }

    const previousState = variationStates[item.id];
    const controller = new AbortController();
    const requestId = activeVariationRequestRef.current.requestId + 1;

    if (activeVariationRequestRef.current.controller) {
      cancelActiveVariationRequest(true);
    }

    activeVariationRequestRef.current = {
      controller,
      requestId,
      sourceId: item.id,
      variationKind,
    };

    setVariationStates((previous) => ({
      ...previous,
      [item.id]: {
        selectedKind: variationKind,
        displayKind: previousState?.displayKind,
        pendingKind: variationKind,
        isLoading: true,
        error: null,
      },
    }));

    try {
      const currentInterest = tone === 'Interest Based' ? interest : undefined;
      const results = await getDeclarativeTranslations({
        imperativeText: getCurrentRequestText(),
        mode: 'variation',
        tone,
        interest: currentInterest,
        useFewerWords,
        sourceTranslation: item,
        variationKind,
        signal: controller.signal,
      });

      if (activeVariationRequestRef.current.requestId !== requestId) {
        trackEvent('variation_stale_response_ignored', {
          mode: 'variation',
          stale_ignored: true,
          variation_kind: variationKind,
          source_translation_id: item.id,
        });
        return;
      }

      setVariationCache((previous) => ({
        ...previous,
        [item.id]: {
          ...(previous[item.id] || {}),
          [variationKind]: results,
        },
      }));
      setVariationStates((previous) => ({
        ...previous,
        [item.id]: {
          selectedKind: variationKind,
          displayKind: variationKind,
          pendingKind: undefined,
          isLoading: false,
          error: null,
        },
      }));
      activeVariationRequestRef.current = {
        controller: null,
        requestId,
        sourceId: null,
        variationKind: null,
      };
      saveRunState(currentRunId, translations, {
        sourceTranslationId: item.id,
        variationKind,
        translations: results,
      });
    } catch (errorValue: unknown) {
      if ((errorValue as { name?: string } | undefined)?.name === 'AbortError') {
        return;
      }

      setVariationStates((previous) => ({
        ...previous,
        [item.id]: {
          ...(previous[item.id] || { isLoading: false, error: null }),
          isLoading: false,
          pendingKind: undefined,
          error: errorValue instanceof Error ? errorValue.message : 'Could not create a variation right now.',
        },
      }));
      activeVariationRequestRef.current = {
        controller: null,
        requestId,
        sourceId: null,
        variationKind: null,
      };
    }
  }, [cancelActiveVariationRequest, currentRunId, getCurrentRequestText, interest, saveRunState, tone, translations, useFewerWords, variationCache, variationStates]);

  const variationKinds = getVariationKinds(useFewerWords);

  return (
    <div className="flex flex-col items-center w-full space-y-6 md:space-y-10">
      <div className="text-center">
        <h2 className="text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight px-2">
          Turn Demands into Connections
        </h2>
        <p className="mt-3 text-base md:text-lg text-gray-600 max-w-2xl mx-auto px-4">
          Enter a statement you want to say, and get gentle, declarative alternatives.
        </p>
      </div>

      <DonationCallout />

      <div className="relative w-full bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-xl shadow-sky-100/50">
        <div className="flex flex-col space-y-6">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleTranslate();
              }
            }}
            placeholder="e.g., 'Brush your teeth'"
            className="w-full p-4 text-lg bg-gray-50 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow placeholder:text-gray-400"
            rows={3}
            disabled={isLoading}
          />
          <div className="flex flex-wrap items-center gap-2 animate-fade-in overflow-hidden">
            <span className="text-sm text-gray-500 font-medium mr-1">Try:</span>
            {examplePrompts.map((prompt) => (
              <button
                key={prompt.label}
                onClick={() => setInputValue(prompt.inputText)}
                disabled={isLoading}
                className="px-3 py-1 text-xs md:text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          <div ref={toneSectionRef} className="space-y-4 pt-5 border-t border-gray-200 mt-2 animate-fade-in">
            <div className="flex justify-between items-center mb-2">
              <label className="block font-semibold text-gray-800">Choose a Tone</label>
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center space-x-1 px-2 py-1 md:px-3 md:py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs md:text-sm font-semibold"
                aria-label="View History"
              >
                <HistoryIcon className="w-4 h-4" />
                <span>Recent</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
              {TONE_OPTIONS.map(({ name, Icon, iconClassName, description }) => {
                const isHelpOpen = openToneHelp === name;
                const toneHelpId = `tone-help-${name.toLowerCase().replace(/\s+/g, '-')}`;
                const hasDescription = Boolean(description);

                return (
                  <div key={name} className="relative">
                    <button
                      onClick={() => handleToneSelect(name)}
                      disabled={isLoading}
                      className={`relative flex w-full min-h-[88px] flex-col items-center justify-center rounded-2xl border-2 p-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${tone === name
                        ? 'bg-sky-50/70 border-sky-500 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${iconClassName}`} />
                      <span className="text-xs md:text-sm font-semibold text-gray-700 text-center">
                        {name}
                      </span>
                    </button>

                    {hasDescription && (
                      <div
                        className="absolute right-2 top-2 z-20"
                        onMouseEnter={() => {
                          if (supportsHover) {
                            setOpenToneHelp(name);
                          }
                        }}
                        onMouseLeave={() => {
                          if (supportsHover) {
                            setOpenToneHelp(current => current === name ? null : current);
                          }
                        }}
                      >
                        <button
                          type="button"
                          aria-label={`Learn more about the ${name} tone`}
                          aria-expanded={isHelpOpen}
                          aria-controls={toneHelpId}
                          onPointerDown={(event) => {
                            toneHelpPointerIntentRef.current = true;
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!supportsHover && toneHelpPointerIntentRef.current) {
                              handleToneHelpToggle(name);
                            }
                            window.setTimeout(() => {
                              toneHelpPointerIntentRef.current = false;
                            }, 0);
                          }}
                          onFocus={(event) => {
                            if (!toneHelpPointerIntentRef.current && event.currentTarget.matches(':focus-visible')) {
                              setOpenToneHelp(name);
                            }
                          }}
                          onBlur={(event) => {
                            toneHelpPointerIntentRef.current = false;
                            handleToneHelpBlur(event);
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 md:h-8 md:w-8 ${isHelpOpen
                            ? 'border-sky-200 bg-white text-sky-700 shadow-sm shadow-sky-100/70'
                            : 'border-transparent bg-transparent text-sky-500 hover:bg-sky-50/90 hover:text-sky-700'
                            }`}
                        >
                          <QuestionMarkCircleIcon className="h-4 w-4" />
                        </button>

                        {isHelpOpen && (
                          <div
                            id={toneHelpId}
                            role="tooltip"
                            onPointerDown={(event) => event.stopPropagation()}
                            className="absolute right-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw-3rem)] rounded-2xl border border-sky-100 bg-white/95 p-3 text-left text-sm leading-relaxed text-slate-600 shadow-xl shadow-sky-100/70 backdrop-blur-sm"
                          >
                            <div className="absolute -top-1 right-3 h-2.5 w-2.5 rotate-45 border-l border-t border-sky-100 bg-white" aria-hidden="true" />
                            <p className="italic">{description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {tone === 'Interest Based' && (
              <div className="w-full mt-4 animate-fade-in">
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => {
                    setInterest(e.target.value);
                    resetVariationUi(false);
                  }}
                  disabled={isLoading}
                  placeholder="e.g. Minecraft"
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow bg-gray-50 placeholder-gray-400"
                />
                <p className="text-xs text-gray-500 mt-2 ml-1">
                  Choose a single interest. Example: Pokemon
                </p>
              </div>
            )}

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200 mt-4 animate-fade-in">
              <div className="flex flex-col">
                <span className="text-gray-900 font-semibold text-sm">Fewer Words</span>
                <span className="text-xs text-gray-500">Shorter responses can reduce demand-based anxiety.</span>
              </div>
              <button
                onClick={() => {
                  setUseFewerWords(!useFewerWords);
                  resetVariationUi(false);
                }}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${useFewerWords ? 'bg-sky-600' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${useFewerWords ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

          </div>

          <div className="pt-2 md:pt-3 flex justify-end">
            <button
              onClick={handleTranslate}
              disabled={isLoading || !inputValue.trim()}
              className="w-full md:w-auto px-8 py-3 bg-sky-600 text-white font-bold rounded-full hover:bg-sky-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              {isLoading ? 'Translating...' : 'Get Ideas'}
            </button>
          </div>
        </div>
      </div>

      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-800">Recent Translations</h3>
                <p className="mt-1 text-sm text-gray-500">Each saved run keeps its own tone, output set, and any saved refinements.</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {history.length > 0 ? (
                <ul className="space-y-3">
                  {history.map(item => {
                    const refinementCount = countSavedVariationSets(item.variations);

                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => handleSelectHistory(item)}
                          className="w-full text-left p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:bg-sky-50 hover:border-sky-300 transition-all"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-sky-700 border border-sky-100">
                              {item.tone || 'Default'}
                            </span>
                            {item.interest && (
                              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-indigo-700 border border-indigo-100">
                                {item.interest}
                              </span>
                            )}
                            {item.useFewerWords && (
                              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200">
                                Fewer words
                              </span>
                            )}
                            {refinementCount > 0 && (
                              <span className="rounded-full bg-white px-2.5 py-1 font-medium text-sky-700 border border-sky-100">
                                {refinementCount} refinement{refinementCount === 1 ? '' : 's'} saved
                              </span>
                            )}
                            <span>{formatHistoryTimestamp(item.updatedAt || item.createdAt)}</span>
                          </div>
                          <p className="mt-3 font-semibold text-gray-800">{item.imperativeText}</p>
                          <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.translations[0]?.translation || 'No suggestions saved.'}</p>
                          <p className="text-sm text-gray-500 mt-3">{item.translations.length} suggestion{item.translations.length === 1 ? '' : 's'} saved in this run</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-center text-gray-500 py-8">Your recent translation runs will appear here, including saved refinement versions for each run.</p>
              )}
            </div>
            {history.length > 0 && (
              <div className="p-6 border-t border-gray-200 mt-auto">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="w-full flex items-center justify-center px-4 py-2 bg-red-50 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <TrashIcon className="w-5 h-5 mr-2" />
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-gray-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center">
            <h4 className="text-xl font-bold text-gray-900">Are you sure?</h4>
            <p className="text-gray-600 mt-2">This will permanently delete your saved translations.</p>
            <div className="mt-6 flex justify-center space-x-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-full hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearHistory}
                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-full hover:bg-red-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col items-center justify-center space-y-3 text-gray-600 pt-8">
          <svg className="animate-spin h-8 w-8 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-lg">{loadingMessage}</span>
        </div>
      )}
      {error && (
        <div className="w-full p-4 bg-red-100 border border-red-300 text-red-800 rounded-xl">
          <p><span className="font-bold">Oops!</span> {error}</p>
        </div>
      )}

      {translations.length > 0 && !isLoading && (
        <div ref={resultsRef} className="w-full space-y-4 pt-4 md:pt-6 scroll-mt-48">
          <h3 className="text-xl md:text-2xl font-bold text-center text-gray-800">Here are a few ideas:</h3>
          <div className="space-y-4 pt-4">
            {translations.map((item) => (
              <TranslationItem
                key={item.id}
                item={item}
                isOpen={openVariationSourceId === item.id}
                onToggleOpen={() => handleToggleVariationPanel(item.id)}
                variationKinds={variationKinds}
                variationCache={variationCache[item.id] || {}}
                variationState={variationStates[item.id]}
                onVariationSelect={handleVariationSelect}
              />
            ))}
          </div>
          {!isLoading && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-8 pb-12">
              <button
                onClick={handleGenerateMore}
                disabled={isGeneratingMore || !currentRunId}
                className="w-full sm:w-auto px-6 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-full hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                {isGeneratingMore ? 'Generating...' : 'Get more ideas'}
              </button>
              <button
                onClick={handleShareTool}
                className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all duration-300 border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 ${hasCopiedShareLink
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-white text-sky-700 border-sky-200 hover:bg-sky-50'
                  }`}
              >
                {hasCopiedShareLink ? <CheckIcon className="w-4 h-4" /> : <ShareIcon className="w-4 h-4" />}
                {hasCopiedShareLink ? 'Link Copied!' : 'Recommend this tool'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
