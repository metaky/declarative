import React, { useState, useEffect, useRef } from 'react';
import { CloseIcon, HeartIcon } from './icons/Icons';
import { trackEvent } from '../services/analytics';
import {
  SUPPORT_LINKS,
  THIRTY_DAYS_MS,
  dismissDonationBannerForSession,
  markShownThisSession,
  restoreDonationBannerSession,
  shouldShowDonationBanner,
  snoozeDonationBanner,
} from '../services/supporterCardStorage';

type BannerDisplayState = 'hidden' | 'active' | 'dismissed-notice';

export const DonationBanner: React.FC = () => {
  const [displayState, setDisplayState] = useState<BannerDisplayState>('hidden');
  const [isOneTimeExpanded, setIsOneTimeExpanded] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const autoHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (shouldShowDonationBanner()) {
      markShownThisSession();
      setDisplayState('active');
      trackEvent('donation_banner_viewed');
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autoHideTimerRef.current !== null) {
        window.clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  const clearAutoHideTimer = () => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  };

  const handleDismissSession = () => {
    clearAutoHideTimer();
    dismissDonationBannerForSession();
    setDisplayState('dismissed-notice');
    trackEvent('donation_banner_dismissed', { duration: 'session' });

    autoHideTimerRef.current = window.setTimeout(() => {
      setDisplayState('hidden');
    }, 6000);
  };

  const handleDismissThirtyDays = (source: 'banner' | 'post_dismiss_strip') => {
    clearAutoHideTimer();
    snoozeDonationBanner(THIRTY_DAYS_MS);
    setDisplayState('hidden');
    trackEvent('donation_banner_dismissed', { duration: '30_days', source });
  };

  const handleUndoDismiss = () => {
    clearAutoHideTimer();
    restoreDonationBannerSession();
    setDisplayState('active');
    trackEvent('donation_banner_dismiss_undone');
  };

  const handleMonthlyClick = () => {
    snoozeDonationBanner(THIRTY_DAYS_MS);
    trackEvent('donation_banner_cta_clicked', {
      type: 'monthly',
      amount: 5,
    });
  };

  const handleOneTimeToggle = () => {
    const next = !isOneTimeExpanded;
    setIsOneTimeExpanded(next);
    if (next) {
      trackEvent('donation_banner_one_time_expanded');
    }
  };

  const handleOneTimeOptionClick = (tier: 'small' | 'large' | 'custom', amount?: number) => {
    snoozeDonationBanner(THIRTY_DAYS_MS);
    trackEvent('donation_banner_cta_clicked', {
      type: 'one_time',
      tier,
      amount: amount ?? 'custom',
    });
  };

  const handleMobileExpandToggle = () => {
    const next = !isMobileExpanded;
    setIsMobileExpanded(next);
    if (next) {
      trackEvent('donation_banner_mobile_read_more');
    }
  };

  if (displayState === 'hidden') {
    return null;
  }

  if (displayState === 'dismissed-notice') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full rounded-xl border border-amber-200/80 bg-amber-50/70 px-3.5 py-2 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2 animate-fade-in"
      >
        <span>Banner hidden for this visit.</span>
        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => handleDismissThirtyDays('post_dismiss_strip')}
            className="font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Dismiss for 30 days
          </button>
          <span className="text-amber-300" aria-hidden="true">·</span>
          <button
            type="button"
            onClick={handleUndoDismiss}
            className="text-amber-800/80 hover:text-amber-950 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => {
              clearAutoHideTimer();
              setDisplayState('hidden');
            }}
            aria-label="Close notification"
            className="text-amber-600/80 hover:text-amber-900 p-0.5 rounded-full hover:bg-amber-100/70 transition-colors cursor-pointer"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const mobileDetailsId = 'donation-banner-mobile-details';

  return (
    <aside
      aria-label="Community support note"
      className="w-full relative rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/95 via-amber-50/75 to-orange-50/50 p-3.5 sm:p-4 md:p-5 shadow-xs animate-fade-in"
    >
      {/* Top Row: Headline + Dismiss Controls */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100/90 text-amber-700"
            aria-hidden="true"
          >
            <HeartIcon className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 tracking-tight text-balance leading-snug">
            Declarative is free — and I&apos;d like to keep it that way.
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0 -mt-0.5 -mr-1">
          <button
            type="button"
            onClick={() => handleDismissThirtyDays('banner')}
            className="hidden sm:inline-flex text-xs font-medium text-amber-800/75 hover:text-amber-950 hover:bg-amber-100/60 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            title="Hide this banner for 30 days"
          >
            Dismiss for 30 days
          </button>
          <button
            type="button"
            onClick={handleDismissSession}
            aria-label="Dismiss banner for now"
            title="Dismiss for now"
            className="inline-flex items-center justify-center rounded-full p-1.5 text-amber-700/70 hover:text-amber-950 hover:bg-amber-100/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer"
          >
            <CloseIcon className="h-4 w-4 md:h-4.5 md:w-4.5" />
          </button>
        </div>
      </div>

      {/* Body Copy: Compact on mobile with inline expand; full editorial copy on desktop */}
      <div className="mt-2 sm:pl-8.5">
        {/* Desktop full message */}
        <p className="hidden md:block text-sm text-gray-700 leading-relaxed text-pretty">
          I&apos;m a dad who built Declarative for our community. Every translation costs real money to run, and ongoing costs can easily exceed what one person can cover alone. By supporting the site, you keep it free for others who need it. Please consider{' '}
          <span className="font-semibold text-gray-900">$5/month</span> — or a one-time gift. It takes 30 seconds.
        </p>

        {/* Mobile compact summary + expandable full message */}
        <div className="md:hidden text-xs text-gray-700 leading-relaxed text-pretty">
          <p>
            I&apos;m a dad who built Declarative for our community. Every translation costs real money to run, and your support keeps it free for others who need it.{' '}
            <button
              type="button"
              onClick={handleMobileExpandToggle}
              aria-expanded={isMobileExpanded}
              aria-controls={mobileDetailsId}
              className="font-semibold text-amber-900 underline decoration-amber-400/90 underline-offset-2 hover:text-amber-950 cursor-pointer"
            >
              {isMobileExpanded ? 'Show less' : 'Read more'}
            </button>
          </p>

          <div
            id={mobileDetailsId}
            hidden={!isMobileExpanded}
            className={`banner-expandable ${isMobileExpanded ? 'is-expanded mt-2 space-y-1.5 pt-2 border-t border-amber-200/60' : ''}`}
          >
            <p className="text-pretty">
              Every translation costs real money to run, and ongoing costs can easily exceed what one person can cover alone. By supporting the site, you keep it free for others who need it. Please consider <span className="font-semibold text-gray-900">$5/month</span> — or a one-time gift. It takes 30 seconds.
            </p>
          </div>
        </div>

        {/* CTAs Row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={SUPPORT_LINKS.monthly}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleMonthlyClick}
            className="inline-flex items-center justify-center px-3.5 py-2 md:px-4 md:py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs md:text-sm font-bold rounded-xl shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-700"
          >
            Give $5/month
          </a>

          {!isOneTimeExpanded ? (
            <button
              type="button"
              onClick={handleOneTimeToggle}
              aria-expanded={isOneTimeExpanded}
              className="inline-flex items-center justify-center px-3.5 py-2 md:px-4 md:py-2 bg-white hover:bg-amber-100/60 text-amber-950 border border-amber-300/90 text-xs md:text-sm font-semibold rounded-xl shadow-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-600 cursor-pointer"
            >
              <span>Give once</span>
              <span className="ml-1.5 text-amber-800/80 font-normal">($3 / $8 / custom)</span>
            </button>
          ) : (
            <div
              role="group"
              aria-label="Choose a one-time gift amount"
              className="inline-flex flex-wrap items-center gap-1.5 bg-white/90 border border-amber-300/90 rounded-xl p-1 shadow-2xs animate-fade-in"
            >
              <span className="text-[11px] font-medium text-amber-900/80 px-2">Give once:</span>
              <a
                href={SUPPORT_LINKS.oneTime.small}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOneTimeOptionClick('small', 3)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-200 text-xs font-bold rounded-lg transition-colors"
              >
                $3
              </a>
              <a
                href={SUPPORT_LINKS.oneTime.large}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOneTimeOptionClick('large', 8)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-200 text-xs font-bold rounded-lg transition-colors"
              >
                $8
              </a>
              <a
                href={SUPPORT_LINKS.oneTime.custom}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleOneTimeOptionClick('custom')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-950 border border-amber-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Custom
              </a>
              <button
                type="button"
                onClick={() => setIsOneTimeExpanded(false)}
                aria-label="Close one-time options"
                className="p-1 text-amber-700/70 hover:text-amber-950 rounded-md hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Mobile 30-day snooze link */}
          <button
            type="button"
            onClick={() => handleDismissThirtyDays('banner')}
            className="sm:hidden ml-auto text-[11px] font-medium text-amber-800/75 hover:text-amber-950 underline underline-offset-2 py-1 cursor-pointer"
          >
            Dismiss 30d
          </button>
        </div>
      </div>
    </aside>
  );
};
