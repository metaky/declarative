import React, { useState, useEffect } from 'react';
import { useHashRouter } from '../hooks/useHashRouter';
import { CloseIcon, HeartIcon } from './icons/Icons';

export const DonationCallout: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const { navigate } = useHashRouter();

  useEffect(() => {
    try {
      const hidePermanently = localStorage.getItem('hideDonationPermanently') === 'true';
      const hideSession = sessionStorage.getItem('hideDonationSession') === 'true';
      
      if (!hidePermanently && !hideSession) {
        setIsVisible(true);
      }
    } catch (error) {
      console.warn('Could not access storage for donation callout', error);
      setIsVisible(true); // Default to showing if storage is blocked
    }
  }, []);

  const handleCloseSession = () => {
    try {
      sessionStorage.setItem('hideDonationSession', 'true');
    } catch (error) {
      // Ignore
    }
    setIsVisible(false);
  };

  const handleNeverShowAgain = () => {
    try {
      localStorage.setItem('hideDonationPermanently', 'true');
    } catch (error) {
      // Ignore
    }
    setIsVisible(false);
  };

  const handleDonateClick = () => {
    navigate('coffee');
    setTimeout(() => {
      document.getElementById('donate-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (!isVisible) return null;

  return (
    <div className="w-full relative bg-amber-50 rounded-2xl border border-amber-200 p-4 md:p-6 shadow-sm animate-fade-in">
      <button 
        onClick={handleCloseSession}
        className="absolute top-2 right-2 md:top-4 md:right-4 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-full p-1 transition-colors"
        aria-label="Close for now"
      >
        <CloseIcon className="w-5 h-5" />
      </button>
      
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
        <div className="flex-shrink-0 hidden md:flex items-center justify-center w-12 h-12 bg-amber-100 rounded-full text-amber-500">
          <HeartIcon className="w-6 h-6" />
        </div>
        
        <div className="flex-grow space-y-2 pr-6 md:pr-8">
          <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
             <span className="md:hidden text-amber-500"><HeartIcon className="w-5 h-5" /></span>
             Support this free tool
          </h3>
          <p className="text-sm md:text-base text-amber-800 leading-relaxed">
            Hi, I'm a dad who built this tool for my PDA autistic child, and I want to keep it free for everyone. If this tool helps your family, please consider a small donation to help keep the lights on.
          </p>
        </div>
        
        <div className="flex flex-col w-full md:w-auto gap-3 flex-shrink-0 mt-3 md:mt-0">
          <button 
            onClick={handleDonateClick}
            className="w-full md:w-auto px-6 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 focus:ring-offset-amber-50"
          >
            Donate to Support
          </button>
          <button 
            onClick={handleNeverShowAgain}
            className="text-xs text-amber-700/70 hover:text-amber-900 underline underline-offset-2 text-center transition-colors"
          >
            Do not show again
          </button>
        </div>
      </div>
    </div>
  );
};
