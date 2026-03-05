import React from 'react';
import type { View } from '../App';

interface FooterProps {
  onShowPrivacy: () => void;
  onShowTerms: () => void;
  onNavigate: (view: View) => void;
}

export const Footer: React.FC<FooterProps> = ({ onShowPrivacy, onShowTerms, onNavigate }) => {
  return (
    <footer className="w-full mt-auto py-6">
      <div className="container mx-auto px-4 text-center text-sm text-gray-500">
        <div className="mb-4">
          Questions? Comments? <a href="mailto:declarativeapp@gmail.com" className="underline hover:text-gray-700 transition-colors">Contact me</a>.
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-2 sm:space-y-0 sm:space-x-4">
            <p>
            Built with care for the PDA community by Kyle Wegner
            </p>
            <span className="hidden sm:inline text-gray-400">|</span>
            <button onClick={() => onNavigate('coffee')} className="underline hover:text-gray-700 transition-colors">
                Support & Donate
            </button>
            <span className="hidden sm:inline text-gray-400">|</span>
            <button onClick={onShowTerms} className="underline hover:text-gray-700 transition-colors">
                Terms of Service
            </button>
            <span className="hidden sm:inline text-gray-400">|</span>
            <button onClick={onShowPrivacy} className="underline hover:text-gray-700 transition-colors">
                Privacy Policy
            </button>
        </div>
      </div>
    </footer>
  );
};