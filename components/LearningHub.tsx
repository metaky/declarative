
import React from 'react';
import type { View } from '../App';
import { BrainIcon, ShieldIcon, CheckCircleIcon, CloseIcon, HeartIcon, SpeechBubbleIcon } from './icons/Icons';

interface LearningHubProps {
  onNavigate: (view: View) => void;
}

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; colorClass: string }> = ({ icon, title, children, colorClass }) => (
  <div className={`p-6 rounded-2xl border ${colorClass} shadow-sm`}>
    <div className="flex items-center mb-4">
      <div className="p-2 bg-white rounded-full shadow-sm mr-3">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-800">{title}</h3>
    </div>
    <div className="text-gray-700 leading-relaxed">
      {children}
    </div>
  </div>
);

export const LearningHub: React.FC<LearningHubProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center w-full space-y-12 animate-fade-in pb-10">
      
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
          Why Language Matters
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          For neurodivergent nervous systems—especially those with a PDA profile—how we ask is just as important as what we ask.
        </p>
      </div>

      {/* Definition Section - SEO Optimized */}
      <div className="w-full bg-white border border-indigo-100 rounded-3xl p-8 shadow-subtle">
        <div className="flex items-center mb-4">
            <div className="p-2 bg-indigo-100 rounded-full mr-3 text-indigo-600">
                <SpeechBubbleIcon className="w-6 h-6" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">What is Declarative Language?</h3>
        </div>
        <div className="text-gray-700 leading-relaxed space-y-4">
            <p>
                At its simplest, <strong>declarative language</strong> is the art of sharing information without expecting a specific response. Unlike <em>imperative language</em> (commands, requests, or questions), which places a demand on the listener, declarative phrasing is an invitation.
            </p>
            <p>
                For many in the <strong>neurodivergent community</strong>, specifically those with a <strong>Pathological Demand Avoidance (PDA)</strong> profile, traditional communication can trigger anxiety. Declarative statements—like observations, narrating your own thoughts, or reflective listening—create a low-pressure environment. This style of communication prioritizes <strong>connection over compliance</strong>, helping to co-regulate the nervous system and build lasting trust.
            </p>
        </div>
      </div>

      {/* The Core Science */}
      <div className="grid md:grid-cols-2 gap-6 w-full">
        <InfoCard 
          icon={<BrainIcon className="w-6 h-6 text-rose-500" />}
          title="The Threat Response"
          colorClass="bg-rose-50/50 border-rose-100"
        >
          <p>
            For a PDA brain, a direct demand (like "Put on your shoes") isn't just annoying—it's perceived as a threat to autonomy. The amygdala activates the <strong>fight, flight, or freeze</strong> response before the child even processes the request.
          </p>
        </InfoCard>

        <InfoCard 
          icon={<ShieldIcon className="w-6 h-6 text-sky-500" />}
          title="Creating Safety"
          colorClass="bg-sky-50/50 border-sky-100"
        >
          <p>
            Declarative language bypasses this threat detection. By stating an observation ("I see shoes by the door") instead of a command, we remove the pressure. This keeps the nervous system in a state of <strong>safety and connection</strong>.
          </p>
        </InfoCard>
      </div>

      {/* Visual Comparison */}
      <div className="w-full bg-white border border-gray-200 rounded-3xl p-8 shadow-subtle">
        <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">The Shift</h3>
        <div className="grid md:grid-cols-2 gap-8">
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-red-500 font-bold uppercase text-sm tracking-wider">
              <CloseIcon className="w-5 h-5" /> <span>Imperative (Command)</span>
            </div>
            <div className="bg-gray-100 p-4 rounded-xl text-gray-500 italic">
              "Put on your coat right now."
            </div>
            <ul className="text-sm text-gray-600 space-y-2 pl-2">
              <li>• Speaker holds all the power.</li>
              <li>• Requires immediate compliance.</li>
              <li>• Triggers resistance.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-green-600 font-bold uppercase text-sm tracking-wider">
              <CheckCircleIcon className="w-5 h-5" /> <span>Declarative (Invitation)</span>
            </div>
            <div className="bg-sky-100 p-4 rounded-xl text-sky-900 font-medium">
              "It's pretty cold outside today."
            </div>
            <ul className="text-sm text-gray-600 space-y-2 pl-2">
              <li>• Shares information and control.</li>
              <li>• Invites problem solving.</li>
              <li>• Maintains connection.</li>
            </ul>
          </div>

        </div>
      </div>

      {/* Why This App Section */}
      <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl">
        <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="p-3 bg-white/10 rounded-full shrink-0">
                <HeartIcon className="w-8 h-8 text-rose-300" />
            </div>
            <div className="space-y-4 w-full">
                <h3 className="text-2xl font-bold text-white">Why I Built This</h3>
                <div className="text-slate-200 space-y-4 leading-relaxed">
                    <p>
                        I’m a dad to a PDA autistic child. I know firsthand the delicate dance of co-regulation. I also know that in the heat of a meltdown, or the rush of the morning routine, my brain defaults to commands—even when I know they don't work.
                    </p>
                    <p>
                        I built this tool because I needed a translator for myself. I needed a way to practice the "Give over Get" mindset until it became second nature.
                    </p>
                    <p>
                        My goal is to keep these tools free so they can reach every parent, caregiver, and teacher who needs them. If this app helps you find a moment of peace or connection, that is a success.
                    </p>
                </div>
                <div className="pt-6 flex flex-col items-start space-y-3">
                     <button 
                        onClick={() => onNavigate('coffee')}
                        className="inline-flex items-center font-semibold text-amber-300 hover:text-amber-200 transition-colors underline underline-offset-4"
                     >
                        Click here to support this project and others like it →
                     </button>
                     <a 
                        href="mailto:declarativeapp@gmail.com"
                        className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white transition-colors"
                     >
                        Contact the Developer
                     </a>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
};