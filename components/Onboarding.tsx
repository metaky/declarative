import React, { useState } from 'react';
import { CloseIcon } from './icons/Icons';

interface OnboardingProps {
  onComplete: () => void;
  onShowPrivacy: () => void;
}

const onboardingSteps = [
  {
    title: 'Welcome to Declarative!',
    description: 'Your co-regulation partner, designed to turn stressful demands into moments of connection and trust.',
    icon: '🤝',
  },
  {
    title: 'The Translator',
    description: "Lost for words? Enter a command like 'Brush your teeth,' and get gentle, declarative alternatives that reduce anxiety.",
    icon: '🔄',
  },
  {
    title: 'Customize Your Tone',
    description: 'Tailor suggestions to your child. Use a humorous tone or even theme them around interests like Pokémon or Minecraft!',
    icon: '🎨',
  },
  {
    title: 'The Learning Hub',
    description: "Want to understand the 'why'? Explore bite-sized articles on PDA and the principles of declarative language.",
    icon: '🧠',
  },
  {
    title: "You're All Set!",
    description: "Ready to build connection? Let's get started on this journey together.",
    icon: '🚀',
  },
];

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onShowPrivacy }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const isFinalStep = currentStep === onboardingSteps.length - 1;

  const handleNext = () => {
    if (!isFinalStep) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const step = onboardingSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all duration-300">
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Skip onboarding"
        >
          <CloseIcon className="w-6 h-6" />
        </button>

        <div className="p-8 md:p-10 text-center">
          <div className="flex justify-center items-center text-5xl mb-6">
            <span className="w-20 h-20 bg-sky-100 rounded-full flex items-center justify-center">{step.icon}</span>
          </div>
          <div className="animate-fade-in">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">{step.title}</h2>
            <p className="text-gray-600 leading-relaxed min-h-[72px]">{step.description}</p>
          </div>
        </div>

        <div className="px-8 pb-8">
            <div className="flex justify-center space-x-2 mb-8">
                {onboardingSteps.map((_, index) => (
                <div
                    key={index}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    currentStep === index ? 'bg-sky-600 scale-125' : 'bg-gray-300'
                    }`}
                />
                ))}
            </div>

            <button
                onClick={handleNext}
                className="w-full px-8 py-3 bg-sky-600 text-white font-bold rounded-full hover:bg-sky-700 disabled:bg-gray-300 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-500/50 shadow-lg shadow-sky-600/20"
            >
                {isFinalStep ? 'Get Started' : 'Continue'}
            </button>
            {isFinalStep && (
                <div className="text-center mt-4">
                    <button onClick={onShowPrivacy} className="text-xs text-gray-500 hover:text-gray-700 underline transition-colors">
                        Privacy Policy
                    </button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};