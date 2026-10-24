import React, { useState } from 'react';
import { PRIVACY_POLICY_CONTENT } from '../constants/privacyPolicy';
import { ArrowLeftIcon, ShieldIcon } from './icons/Icons';
import { isAnalyticsOptedOut, setAnalyticsOptOut } from '../services/analytics';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
  const [optedOut, setOptedOut] = useState<boolean>(() => isAnalyticsOptedOut());

  const handleToggleOptOut = () => {
    const nextValue = !optedOut;
    setAnalyticsOptOut(nextValue);
    setOptedOut(nextValue);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800 flex flex-col animate-fade-in">
      <header className="bg-white/80 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center max-w-4xl">
          <button
            onClick={onBack}
            className="flex items-center justify-center p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 ml-4">
            Privacy Policy
          </h1>
        </div>
      </header>
      <main className="flex-grow container mx-auto p-4 md:p-8 lg:p-10 w-full max-w-4xl space-y-6">
        <section
          aria-label="Privacy Controls"
          className="bg-white p-5 md:p-6 rounded-2xl border border-sky-200 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-100 text-sky-600 rounded-full shrink-0 mt-0.5">
              <ShieldIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-gray-900">
                Analytics &amp; Session Recording Controls
              </h2>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                {optedOut
                  ? 'You have opted out of PostHog analytics and session recordings on this browser.'
                  : 'Anonymous usage analytics and masked session recordings are currently enabled to help improve translation quality.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleToggleOptOut}
            aria-pressed={optedOut}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 cursor-pointer ${
              optedOut
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200'
            }`}
          >
            {optedOut ? 'Opted Out (Click to Re-enable)' : 'Opt Out on This Browser'}
          </button>
        </section>

        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-subtle">
          {PRIVACY_POLICY_CONTENT}
        </div>
      </main>
    </div>
  );
};
