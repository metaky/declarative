import React, { useState } from 'react';
import type { View } from '../App';
import { CoffeeIcon, ShareIcon, CheckIcon } from './icons/Icons';

interface HeaderProps {
  currentView: View;
  setCurrentView: (view: View) => void;
}

const NavLink: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm md:text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 whitespace-nowrap ${
        isActive
          ? 'text-sky-700 bg-sky-50'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
};

export const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleShare = async () => {
    const shareData = {
      title: 'Declarative Language Tool',
      text: 'Check out this Declarative Language translator for PDA and neurodivergent communication!',
      url: 'https://declarativeapp.org',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.debug('Share cancelled or failed', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
  };

  return (
    <header className="bg-white/80 border-b border-gray-200 sticky top-0 z-10 backdrop-blur-sm w-full overflow-hidden">
      <div className="container mx-auto px-4 py-3 md:py-4 max-w-4xl">
        {/* Top Branding Row */}
        <div className="flex justify-between items-center w-full mb-1">
          <div 
            className="flex items-center space-x-2 md:space-x-3 cursor-pointer group" 
            onClick={() => setCurrentView('translator')}
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 md:h-9 md:w-9 text-sky-600 group-hover:text-sky-700 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
              <h1 className="text-xl md:text-3xl font-extrabold text-gray-900 tracking-tight group-hover:text-gray-700 transition-colors">Declarative</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button
                onClick={handleShare}
                className={`flex items-center space-x-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 border ${
                    hasCopied 
                    ? 'bg-green-50 text-green-700 border-green-200' 
                    : 'bg-sky-50/50 text-sky-700/70 hover:bg-sky-100 hover:text-sky-800 border-sky-100'
                }`}
            >
                {hasCopied ? <CheckIcon className="w-4 h-4 md:w-5 md:h-5" /> : <ShareIcon className="w-4 h-4 md:w-5 md:h-5" />}
                <span className="text-xs md:text-sm font-bold">{hasCopied ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
                onClick={() => setCurrentView('coffee')}
                className={`flex items-center space-x-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 ${
                    currentView === 'coffee'
                    ? 'bg-amber-100 text-amber-700 shadow-sm ring-1 ring-amber-300'
                    : 'bg-amber-50/50 text-amber-700/70 hover:bg-amber-100 hover:text-amber-800 border border-amber-100'
                }`}
            >
                <CoffeeIcon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-bold">Support</span>
            </button>
          </div>
        </div>

        {/* Navigation Sub-header */}
        <nav className="flex justify-center items-center space-x-1 md:space-x-4 overflow-x-auto no-scrollbar pt-2">
            <NavLink
                label="Translator"
                isActive={currentView === 'translator'}
                onClick={() => setCurrentView('translator')}
            />
            <NavLink
                label="Learn"
                isActive={currentView === 'learn'}
                onClick={() => setCurrentView('learn')}
            />
            <NavLink
                label="Other Tools"
                isActive={currentView === 'other-tools'}
                onClick={() => setCurrentView('other-tools')}
            />
        </nav>
      </div>
    </header>
  );
};