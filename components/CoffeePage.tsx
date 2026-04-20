import React, { useEffect, useState } from 'react';
import { CoffeeIcon, HeartIcon, ShieldIcon } from './icons/Icons';

const SUPPORT_LINKS = {
  oneTime: {
    small: 'https://buy.stripe.com/9B628kghogpNcM10fPfw402',
    large: 'https://donate.stripe.com/7sY4gs7KS2yXaDT8Mlfw403',
    custom: 'https://buy.stripe.com/4gM00ce9g2yX9zPbYxfw400',
  },
  monthly: 'https://buy.stripe.com/8x2bIU7KS2yXdQ54w5fw405',
  manageMonthly: 'https://billing.stripe.com/p/login/4gM00ce9g2yX9zPbYxfw400',
};

interface CoffeePageProps {
  onShowPrivacy: () => void;
  onShowTerms: () => void;
}

type OneTimeOption = keyof typeof SUPPORT_LINKS.oneTime;

export const CoffeePage: React.FC<CoffeePageProps> = ({ onShowPrivacy, onShowTerms }) => {
  const [selectedOption, setSelectedOption] = useState<OneTimeOption | null>(null);
  const isLoading = false;

  useEffect(() => {
    if (window.location.hash !== '#/coffee/donate') return;

    const scrollToDonateSection = () => {
      document.getElementById('donate-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const timeoutId = window.setTimeout(scrollToDonateSection, 50);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const openExternalLink = (link: string) => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const handleOneTimeSupportClick = () => {
    if (!selectedOption) return;

    const link = SUPPORT_LINKS.oneTime[selectedOption];
    if (link) {
      openExternalLink(link);
    }
  };

  const handleMonthlySupportClick = () => {
    openExternalLink(SUPPORT_LINKS.monthly);
  };

  const handleManageMonthlyClick = () => {
    openExternalLink(SUPPORT_LINKS.manageMonthly);
  };

  return (
    <div className="flex flex-col items-center w-full space-y-10 animate-fade-in pb-10">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight flex justify-center items-center gap-3">
          Support the Mission
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Help keep these tools free for the families who need them most.
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-8">
        
        {/* Content Section */}
        <div className="space-y-6">
            {/* Personal Story Card */}
            <div className="p-8 bg-white rounded-3xl border border-rose-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-rose-50 rounded-full blur-xl opacity-50"></div>
                <div className="flex items-center mb-4 relative z-10">
                    <div className="p-2 bg-rose-100 rounded-full mr-3 text-rose-500">
                        <HeartIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">A Personal Note</h3>
                </div>
                <div className="text-gray-700 space-y-4 leading-relaxed relative z-10">
                     <p>
                        Hi, I'm a dad to a PDA autistic child. I'm not a professional software developer, but like many of you, I've navigated the complex, challenging, and often lonely journey of understanding neurodiversity and finding ways to truly connect with my child.
                    </p>
                    <p>
                         This tool comes directly from that personal experience. I built it because I needed it, and I suspect others can benefit from it too.
                    </p>
                </div>
            </div>

             {/* The "Why Donate" Card */}
             <div className="p-8 bg-white rounded-3xl border border-sky-100 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-sky-50 rounded-full blur-xl opacity-50"></div>
                 <div className="flex items-center mb-4 relative z-10">
                    <div className="p-2 bg-sky-100 rounded-full mr-3 text-sky-600">
                        <ShieldIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Why Support?</h3>
                </div>
                <div className="text-gray-700 space-y-4 leading-relaxed relative z-10">
                    <p>
                        My goal is to provide these tools <strong>at no cost</strong> so they can help the most number of people.
                    </p>
                    <p>
                        However, running AI-powered applications incurs real server and API costs. Your contribution helps keep the lights on and supports the development of more tools for our community.
                    </p>
                </div>
             </div>
        </div>

        {/* Donation Widget */}
        <div id="donate-section" className="flex flex-col scroll-mt-24">
             <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-8 rounded-3xl border border-amber-100 shadow-lg flex-grow flex flex-col justify-center">
                <div className="text-center mb-8">
                     <div className="inline-block p-4 bg-white rounded-full shadow-sm mb-4">
                        <CoffeeIcon className="w-10 h-10 text-amber-600" />
                     </div>
                     <h3 className="text-2xl font-bold text-gray-900">Buy me a coffee</h3>
                     <p className="text-amber-800 mt-2">Choose a one-time gift, or support the project monthly.</p>
                </div>

                <div className="space-y-5 max-w-md mx-auto w-full">
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setSelectedOption('small')}
                            disabled={isLoading}
                            className={`py-3 px-2 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center bg-white ${
                                selectedOption === 'small'
                                    ? 'border-amber-500 text-amber-600 shadow-md transform scale-105'
                                    : 'border-transparent text-gray-600 hover:border-amber-200 hover:shadow-sm'
                            }`}
                        >
                            <span className="text-xl font-bold">$3</span>
                            <span className="text-xs font-medium opacity-80">Small</span>
                        </button>

                        <button
                            onClick={() => setSelectedOption('large')}
                            disabled={isLoading}
                            className={`py-3 px-2 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center bg-white ${
                                selectedOption === 'large'
                                    ? 'border-amber-500 text-amber-600 shadow-md transform scale-105'
                                    : 'border-transparent text-gray-600 hover:border-amber-200 hover:shadow-sm'
                            }`}
                        >
                            <span className="text-xl font-bold">$8</span>
                            <span className="text-xs font-medium opacity-80">Medium</span>
                        </button>

                        <button
                            onClick={() => setSelectedOption('custom')}
                            disabled={isLoading}
                            className={`py-3 px-2 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center bg-white ${
                                selectedOption === 'custom'
                                    ? 'border-amber-500 text-amber-600 shadow-md transform scale-105'
                                    : 'border-transparent text-gray-600 hover:border-amber-200 hover:shadow-sm'
                            }`}
                        >
                            <span className="text-xl font-bold">Custom</span>
                            <span className="text-xs font-medium opacity-80">Enter amount</span>
                        </button>
                    </div>

                    <button
                        onClick={handleOneTimeSupportClick}
                        disabled={isLoading || !selectedOption}
                        className="w-full py-4 bg-gray-900 text-white text-lg font-bold rounded-2xl hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-gray-900/30 shadow-lg flex justify-center items-center"
                    >
                        Support Once
                    </button>

                    <div className="pt-5 border-t border-amber-200/80 space-y-3">
                        <div className="text-center space-y-1">
                            <p className="text-sm font-semibold text-sky-900">Prefer ongoing support?</p>
                            <p className="text-xs text-gray-600">Monthly support renews each month until you cancel in Stripe and helps cover recurring hosting and AI costs.</p>
                        </div>

                        <button
                            onClick={handleMonthlySupportClick}
                            disabled={isLoading}
                            className="w-full py-4 bg-sky-700 text-white text-lg font-bold rounded-2xl hover:bg-sky-800 disabled:bg-sky-300 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-700/25 shadow-lg shadow-sky-200/50 flex justify-center items-center"
                        >
                            Support $5/Month
                        </button>

                        <button
                            onClick={handleManageMonthlyClick}
                            disabled={isLoading}
                            className="w-full py-3 bg-white text-sky-700 text-sm font-semibold rounded-2xl border border-sky-200 hover:bg-sky-50 disabled:text-sky-300 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-sky-700/15"
                        >
                            Manage Monthly Support
                        </button>
                    </div>

                     <p className="text-center text-xs text-amber-800/70 font-medium px-4 leading-relaxed">
                         One-time gifts are charged once. Monthly support renews until canceled in Stripe. By donating, you agree to our <button onClick={onShowTerms} className="underline hover:text-amber-900">Terms of Service</button> and <button onClick={onShowPrivacy} className="underline hover:text-amber-900">Privacy Policy</button>. Secure payment processing via Stripe.
                     </p>
                </div>
             </div>
        </div>

      </div>
    </div>
  );
};
