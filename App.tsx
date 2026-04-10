import React, { useState, useEffect } from 'react';
import { useHashRouter } from './hooks/useHashRouter';
import { useSEO } from './hooks/useSEO';
import { Header } from './components/Header';
import { Translator } from './components/Translator';
import { LearningHub } from './components/LearningHub';
import { OtherTools } from './components/OtherTools';
import { Footer } from './components/Footer';
import { Onboarding } from './components/Onboarding';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { TermsOfService } from './components/TermsOfService';
import { CoffeePage } from './components/CoffeePage';
import { clearHistoryEntries, loadHistoryEntries, prependHistoryEntry, saveHistoryEntries } from './services/historyStorage';
import type { HistoryEntryInput, HistoryItem } from './types';

export type View = 'translator' | 'learn' | 'other-tools' | 'coffee';

const App: React.FC = () => {
  const { currentView, navigate: setCurrentView } = useHashRouter();
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistoryEntries());

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

  // Initialize SEO management
  useSEO({ 
    currentView, 
    showPrivacy: showPrivacyPolicy, 
    showTerms: showTermsOfService 
  });

  useEffect(() => {
    saveHistoryEntries(history);
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


  const handleHistorySave = (entry: HistoryEntryInput) => {
    setHistory(prevHistory => prependHistoryEntry(prevHistory, entry));
  };

  const handleClearHistory = () => {
    setHistory([]);
    clearHistoryEntries();
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
        {currentView === 'translator' && <Translator history={history} onHistorySave={handleHistorySave} onClearHistory={handleClearHistory} />}
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
