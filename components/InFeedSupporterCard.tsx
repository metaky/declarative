import React, { useState, useEffect } from 'react';
import { CloseIcon } from './icons/Icons';
import {
  FOURTEEN_DAYS_MS,
  THIRTY_DAYS_MS,
  markShownThisSession,
  shouldShowSupporterCard,
  snoozeSupporterCard,
} from '../services/supporterCardStorage';

const SUPPORT_LINKS = {
  monthly: 'https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405',
};

export const InFeedSupporterCard: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (shouldShowSupporterCard()) {
      markShownThisSession();
      setIsVisible(true);
    }
  }, []);

  const handleSnooze = () => {
    snoozeSupporterCard(FOURTEEN_DAYS_MS);
    setIsVisible(false);
  };

  const handleSupportClick = () => {
    snoozeSupporterCard(THIRTY_DAYS_MS);
  };

  const handleMoreWaysClick = () => {
    snoozeSupporterCard(THIRTY_DAYS_MS);
    window.location.hash = '#/coffee/donate';
  };

  if (!isVisible) return null;

  return (
    <div className="bg-amber-50/50 hover:bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4 transition-colors relative animate-fade-in my-2">
      <button
        onClick={handleSnooze}
        className="absolute top-3 right-3 text-amber-500/70 hover:text-amber-800 hover:bg-amber-100/60 rounded-full p-1 transition-colors"
        aria-label="Snooze for 14 days"
        title="Snooze for 14 days"
      >
        <CloseIcon className="w-4 h-4" />
      </button>

      <div className="pr-6">
        <h4 className="text-sm font-semibold text-amber-950 flex items-center gap-1.5">
          <span>💛</span> Kept free by sustaining families
        </h4>
        <p className="mt-1 text-xs text-amber-900/80 leading-relaxed">
          Running this site costs real server fees. If Declarative helps your home, join our monthly supporters.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <a
          href={SUPPORT_LINKS.monthly}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSupportClick}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
        >
          Give $5/mo
        </a>
        <button
          onClick={handleMoreWaysClick}
          className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-200/80 text-xs font-medium rounded-xl transition-colors shadow-2xs"
        >
          More ways to support
        </button>
        <button
          onClick={handleSnooze}
          className="text-xs text-amber-800/60 hover:text-amber-950 underline px-1.5 py-1 ml-auto"
        >
          Snooze 14d
        </button>
      </div>
    </div>
  );
};
