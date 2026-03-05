import React from 'react';
import { 
  DocumentSearchIcon, 
  SparklesIcon, 
  ChartBarIcon, 
  ClipboardCheckIcon, 
  ShieldIcon,
  HeartIcon,
  BrainIcon,
  SpeechBubbleIcon
} from './icons/Icons';

export const OtherTools: React.FC = () => {
  return (
    <div className="flex flex-col items-center w-full space-y-10 animate-fade-in pb-10">
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Other Tools for the Community
        </h2>
        <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
          More resources built by and for neurodivergent families to support advocacy and connection.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full">
        {/* Card 1: PDA Your IEP Assistant */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-subtle p-8 flex flex-col h-full hover:shadow-lg transition-shadow duration-300 relative overflow-hidden group">
             {/* Decorative background element */}
             <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-indigo-50 rounded-full opacity-50 blur-2xl group-hover:bg-indigo-100 transition-colors"></div>

             <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <DocumentSearchIcon className="w-8 h-8" />
                </div>
                <div className="text-indigo-300">
                    <SparklesIcon className="w-6 h-6" />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-3 relative z-10">PDA Your IEP Assistant</h3>
            <p className="text-gray-600 leading-relaxed mb-6 flex-grow relative z-10">
                Now Live! Upload your child's IEP or 504 Plan and get instant, privacy-conscious feedback on goals and supports through a PDA-affirming lens.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4 mb-8 bg-gray-50 p-5 rounded-2xl relative z-10">
                <div className="flex items-start">
                    <ChartBarIcon className="w-5 h-5 text-indigo-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-gray-800 text-sm block">Goal Analysis</span>
                        <span className="text-xs text-gray-500">Ensure goals are SMART and don't trigger demand avoidance.</span>
                    </div>
                </div>
                <div className="flex items-start">
                    <ShieldIcon className="w-5 h-5 text-indigo-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-gray-800 text-sm block">PDA Affirming Score</span>
                        <span className="text-xs text-gray-500">Get a 1-100 score on how well the IEP supports regulation.</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 relative z-10 mb-8">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                    AI Analysis
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Privacy First
                </span>
            </div>

            <div className="relative z-10">
                <a 
                    href="https://pdayouriep.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center shadow-lg shadow-indigo-200 transform group-hover:scale-[1.02]"
                >
                    Visit PDA Your IEP
                </a>
            </div>
        </div>

        {/* Card 2: Behavior Report Analyzer */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-subtle p-8 flex flex-col h-full hover:shadow-lg transition-shadow duration-300 relative overflow-hidden group">
             {/* Decorative background element */}
             <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-sky-50 rounded-full opacity-50 blur-2xl group-hover:bg-sky-100 transition-colors"></div>

             <div className="flex justify-between items-start mb-6 relative z-10">
                <div className="p-3 bg-sky-100 text-sky-600 rounded-xl">
                    <BrainIcon className="w-8 h-8" />
                </div>
                <div className="text-sky-300">
                    <SparklesIcon className="w-6 h-6" />
                </div>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 mb-3 relative z-10">Behavior Report Analyzer</h3>
            <p className="text-gray-600 leading-relaxed mb-6 flex-grow relative z-10">
                Upload a Behavior Incident Report and the student's IEP to compare the incident response to IEP accommodations, outlining discrepancies and opportunities with specific PDA considerations for the future.
            </p>

            {/* Feature Highlights */}
            <div className="space-y-4 mb-8 bg-gray-50 p-5 rounded-2xl relative z-10">
                <div className="flex items-start">
                    <ClipboardCheckIcon className="w-5 h-5 text-sky-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-gray-800 text-sm block">Compliance Checking</span>
                        <span className="text-xs text-gray-500">Automatically cross-reference incident responses with mandated IEP supports.</span>
                    </div>
                </div>
                <div className="flex items-start">
                    <ShieldIcon className="w-5 h-5 text-sky-500 mt-0.5 mr-3 flex-shrink-0" />
                    <div>
                        <span className="font-semibold text-gray-800 text-sm block">Advocacy Roadmap</span>
                        <span className="text-xs text-gray-500">Generate evidence-based suggestions for future PDA-affirming accommodations.</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 relative z-10 mb-8">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                    Advocacy
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    Compliance
                </span>
            </div>

            <div className="relative z-10">
                <a 
                    href="https://pdayouriep.org/behavior-report"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 transition-all duration-300 flex items-center justify-center shadow-lg shadow-sky-200 transform group-hover:scale-[1.02]"
                >
                    Analyze Behavior Report
                </a>
            </div>
        </div>
      </div>

      {/* Card 3: More Coming Soon - Lower on the page */}
      <div className="w-full max-w-2xl bg-gray-50 rounded-3xl border border-dashed border-gray-300 p-12 flex flex-col items-center justify-center text-center relative overflow-hidden mt-6">
           <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px]"></div>
           <div className="relative z-10 flex flex-col items-center max-w-sm">
              <div className="p-4 bg-white rounded-full shadow-sm mb-6 text-gray-400">
                  <HeartIcon className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-500 mb-3">More Tools Coming Soon</h3>
              <p className="text-gray-400 leading-relaxed mb-6">
                  I'm constantly working on new ideas to support the neurodivergent community and bridge the gap between school and home.
              </p>
              <div className="text-sm text-gray-400 font-medium">
                  Have an idea for a tool? <a href="mailto:declarativeapp@gmail.com" className="underline hover:text-gray-600">Let me know</a>.
              </div>
           </div>
      </div>
    </div>
  );
};