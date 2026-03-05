import React from 'react';
import { PRIVACY_POLICY_CONTENT } from '../constants/privacyPolicy';
import { ArrowLeftIcon } from './icons/Icons';

interface PrivacyPolicyProps {
  onBack: () => void;
}

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
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
      <main className="flex-grow container mx-auto p-4 md:p-8 lg:p-10 w-full max-w-4xl">
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-subtle">
          {PRIVACY_POLICY_CONTENT}
        </div>
      </main>
    </div>
  );
};
