import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getDeclarativeTranslations } from '../services/geminiService';
import type { Translation, HistoryEntryInput, HistoryItem } from '../types';
import { CopyIcon, CheckIcon, SpeechBubbleIcon, AlignLeftIcon, LaughingFaceIcon, BalanceScaleIcon, StarIcon, HistoryIcon, TrashIcon, CloseIcon, ShareIcon, QuestionMarkCircleIcon } from './icons/Icons';
import { DonationCallout } from './DonationCallout';

interface TranslatorProps {
  history: HistoryItem[];
  onHistorySave: (entry: HistoryEntryInput) => void;
  onClearHistory: () => void;
}

const TranslationItem: React.FC<{ item: Translation }> = ({ item }) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.translation);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-subtle transition-all duration-300">
      <div className="flex justify-between items-start space-x-4">
        <p className="flex-grow text-lg text-gray-700 leading-relaxed">{item.translation}</p>
        <div className="flex-shrink-0 flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            aria-label="Copy to clipboard"
          >
            {hasCopied ? <CheckIcon className="w-5 h-5 text-green-600" /> : <CopyIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
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
    description: ""
  },
  {
    name: 'Straightforward',
    Icon: AlignLeftIcon,
    iconClassName: 'text-slate-500',
    description: "Short, clear, and low-pressure phrasing that gets to the point without sounding bossy, playful, or overexplained."
  },
  {
    name: 'Humorous',
    Icon: LaughingFaceIcon,
    iconClassName: 'text-amber-500',
    description: "Humor surprises the brain and breaks through anxiety, lowering defenses and making the interaction feel safe and fun."
  },
  {
    name: 'Equalizing',
    Icon: BalanceScaleIcon,
    iconClassName: 'text-teal-500',
    description: "Making the child feel more powerful or capable than the adult reduces the threat of authority, helping them feel safe enough to move forward."
  },
  {
    name: 'Interest Based',
    Icon: StarIcon,
    iconClassName: 'text-indigo-500',
    description: "Connecting through their passions creates immediate safety and joy, significantly lowering the PDA threat response to everyday transitions."
  },
];

const LOADING_MESSAGES = [
  "Forming recommendations. This only takes a few seconds...",
  "Translating your statement. Deep breath, you're almost there.",
  "Analyzing the demand. Hang tight, help is on the way.",
  "Crafting connecting ideas. Just a moment...",
  "Reframing the request. You're doing a great job.",
  "Generating gentle alternatives. Take a slow breath...",
  "Preparing declarative options. Almost done...",
  "Gathering suggestions. This will just be a few seconds."
];

const historyDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const formatHistoryTimestamp = (createdAt: string) => historyDateFormatter.format(new Date(createdAt));

export const Translator: React.FC<TranslatorProps> = ({ history, onHistorySave, onClearHistory }) => {
  const [inputValue, setInputValue] = useState('');
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState(TONE_OPTIONS[0].name);
  const [hasCopiedShareLink, setHasCopiedShareLink] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [openToneHelp, setOpenToneHelp] = useState<string | null>(null);
  const [supportsHover, setSupportsHover] = useState(false);

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

  useEffect(() => {
    try {
      localStorage.setItem('savedInterest', interest);
    } catch (e) {
      // Ignore errors
    }
  }, [interest]);

  const fetchChallengeToken = async () => {
    try {
      const res = await fetch("/api/challenge");
      if (!res.ok) {
        setChallengeId(null);
        return;
      }

      const data = await res.json();
      if (data.challengeId) {
        setChallengeId(data.challengeId);
        return;
      }

      setChallengeId(null);
    } catch (e) {
      setChallengeId(null);
      console.error("Failed to fetch challenge", e);
    }
  };

  // Fetch token on mount
  useEffect(() => {
    fetchChallengeToken();
  }, []);

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

  // Auto-scroll to results when translations are populated and loading is finished
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

  const handleToneSelect = useCallback((toneName: string) => {
    setTone(toneName);
    setOpenToneHelp(null);
  }, []);

  const handleToneHelpToggle = useCallback((toneName: string) => {
    setOpenToneHelp(current => current === toneName ? null : toneName);
  }, []);

  const handleToneHelpBlur = useCallback((event: React.FocusEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
      setOpenToneHelp(null);
    }
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    const requestText = inputValue.trim();
    setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
    setIsLoading(true);
    setError(null);
    setTranslations([]);
    shouldScrollToResults.current = true; // Mark for scrolling

    try {
      const currentInterest = tone === 'Interest Based' ? interest : undefined;
      const results = await getDeclarativeTranslations(requestText, [], tone, currentInterest, useFewerWords, challengeId);
      setTranslations(results);
      onHistorySave({
        imperativeText: requestText,
        translations: results,
        tone,
        interest: currentInterest,
        useFewerWords,
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
      fetchChallengeToken(); // Refresh token for next request
    }
  }, [inputValue, isLoading, onHistorySave, tone, interest, useFewerWords, challengeId]);

  const handleGenerateMore = useCallback(async () => {
    if (!inputValue.trim() || isGeneratingMore) return;
    const requestText = inputValue.trim();
    setIsGeneratingMore(true);
    setError(null);

    try {
      const currentInterest = tone === 'Interest Based' ? interest : undefined;
      const results = await getDeclarativeTranslations(requestText, translations, tone, currentInterest, useFewerWords, challengeId);
      const combinedTranslations = [...translations, ...results];
      setTranslations(combinedTranslations);
      onHistorySave({
        imperativeText: requestText,
        translations: combinedTranslations,
        tone,
        interest: currentInterest,
        useFewerWords,
      });
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsGeneratingMore(false);
      fetchChallengeToken(); // Refresh token for next request
    }
  }, [inputValue, isGeneratingMore, translations, onHistorySave, tone, interest, useFewerWords, challengeId]);

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
    setTranslations(item.translations);
    setTone(item.tone || TONE_OPTIONS[0].name);
    setInterest(item.interest || '');
    setUseFewerWords(item.useFewerWords || false);
    setError(null);
    setIsLoading(false);
    setIsHistoryModalOpen(false);
    shouldScrollToResults.current = true; // Mark for scrolling
  };

  const handleConfirmClearHistory = () => {
    onClearHistory();
    setShowClearConfirm(false);
    setIsHistoryModalOpen(false);
  }

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
                  onChange={(e) => setInterest(e.target.value)}
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
                onClick={() => setUseFewerWords(!useFewerWords)}
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
                <p className="mt-1 text-sm text-gray-500">Each saved run keeps its own tone and output set.</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                <CloseIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {history.length > 0 ? (
                <ul className="space-y-3">
                  {history.map(item => (
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
                          <span>{formatHistoryTimestamp(item.createdAt)}</span>
                        </div>
                        <p className="mt-3 font-semibold text-gray-800">{item.imperativeText}</p>
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.translations[0]?.translation || 'No suggestions saved.'}</p>
                        <p className="text-sm text-gray-500 mt-3">{item.translations.length} suggestion{item.translations.length === 1 ? '' : 's'} saved in this run</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-500 py-8">Your recent translation runs will appear here, including tone-specific versions of the same prompt.</p>
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
            {translations.map((item, index) => (
              <TranslationItem key={index} item={item} />
            ))}
          </div>
          {!isLoading && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-8 pb-12">
              <button
                onClick={handleGenerateMore}
                disabled={isGeneratingMore}
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
