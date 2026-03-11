import React, { useState, useEffect } from 'react';
import { useHashRouter } from './hooks/useHashRouter';
import { Header } from './components/Header';
import { Translator } from './components/Translator';
import { LearningHub } from './components/LearningHub';
import { OtherTools } from './components/OtherTools';
import { Footer } from './components/Footer';
import { Onboarding } from './components/Onboarding';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { CoffeePage } from './components/CoffeePage';
import type { HistoryItem, Translation } from './types';

export type View = 'translator' | 'learn' | 'other-tools' | 'coffee';

const App: React.FC = () => {
  const { currentView, navigate: setCurrentView } = useHashRouter();
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const savedHistory = localStorage.getItem('translationHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
      console.error('Could not load history from localStorage', error);
      return [];
    }
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      // Show onboarding if the flag isn't explicitly 'true'
      return localStorage.getItem('onboardingComplete') !== 'true';
    } catch (e) {
      // If localStorage is inaccessible, don't show onboarding to avoid breaking the app.
      console.warn('Could not access localStorage. Onboarding will be skipped.');
      return false;
    }
  });

  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);

  // Fix: Corrected the malformed try-catch block in useEffect. This syntax error was causing the component scope to close prematurely, leading to all subsequent errors.
  useEffect(() => {
    try {
      localStorage.setItem('translationHistory', JSON.stringify(history));
    } catch (error) {
      console.error('Could not save history to localStorage', error);
    }
  }, [history]);


  const handleOnboardingComplete = () => {
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboarding(false);
  };

  const handleShowPrivacyFromOnboarding = () => {
    // Mark onboarding as complete, hide it, and show the privacy policy.
    localStorage.setItem('onboardingComplete', 'true');
    setShowOnboarding(false);
    setShowPrivacyPolicy(true);
  };


  const handleHistoryUpdate = (imperativeText: string, newTranslations: Translation[], isAppending: boolean, tone?: string, interest?: string, useFewerWords?: boolean) => {
    setHistory(prevHistory => {
      const existingIndex = prevHistory.findIndex(item => item.imperativeText.toLowerCase() === imperativeText.toLowerCase());

      if (existingIndex !== -1) {
        // Item exists, update it and move to front
        const updatedHistory = [...prevHistory];
        const existingItem = updatedHistory.splice(existingIndex, 1)[0];

        const combinedTranslations = isAppending
          ? [...existingItem.translations, ...newTranslations]
          : newTranslations;

        const updatedItem = { ...existingItem, translations: combinedTranslations, tone, interest, useFewerWords };
        return [updatedItem, ...updatedHistory];
      } else {
        // New item, add to front
        const newItem: HistoryItem = {
          id: new Date().toISOString(),
          imperativeText,
          translations: newTranslations,
          tone,
          interest,
          useFewerWords,
        };
        return [newItem, ...prevHistory];
      }
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('translationHistory');
    } catch (error) {
      console.error('Could not clear history from localStorage', error);
    }
  };

  // Show privacy policy page
  if (showPrivacyPolicy) {
    return <PrivacyPolicy onBack={() => setShowPrivacyPolicy(false)} />;
  }

  // Show terms of service page
  if (showTermsOfService) {
    return <TermsOfService onBack={() => setShowTermsOfService(false)} />;
  }

  return (
    <div className="min-h-screen bg-transparent font-sans text-gray-800 flex flex-col relative">
      {/* Maintenance Banner Removed */}
      <Header currentView={currentView} setCurrentView={setCurrentView} />
      <main className="flex-grow container mx-auto p-4 md:p-8 lg:p-10 w-full max-w-4xl">
        {currentView === 'translator' && <Translator history={history} onHistoryUpdate={handleHistoryUpdate} onClearHistory={handleClearHistory} />}
        {currentView === 'learn' && <LearningHub onNavigate={setCurrentView} />}
        {currentView === 'other-tools' && <OtherTools />}
        {currentView === 'coffee' && (
          <CoffeePage
            onShowPrivacy={() => setShowPrivacyPolicy(true)}
            onShowTerms={() => setShowTermsOfService(true)}
          />
        )}
      </main>
      <Footer
        onShowPrivacy={() => setShowPrivacyPolicy(true)}
        onShowTerms={() => setShowTermsOfService(true)}
        onNavigate={setCurrentView}
      />

      {/* Onboarding Overlay - Renders on top of the app content */}
      {showOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} onShowPrivacy={handleShowPrivacyFromOnboarding} />
      )}
    </div>
  );
};

export default App;