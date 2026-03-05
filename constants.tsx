import React from 'react';
import type { LearningArticle } from './types';

export const LEARNING_ARTICLES: LearningArticle[] = [
  {
    id: 'what-is-pda',
    title: 'What is PDA? (A Nervous System, Not Defiance)',
    content: (
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>Pathological Demand Avoidance (PDA) is widely understood to be a profile on the autism spectrum. The central difficulty for people with a PDA profile is their anxiety-driven need to avoid the everyday demands and expectations placed upon them by others.</p>
        <p>This isn't a choice or a behavioral issue; it's a neurological reality. Their nervous system perceives demands—even small, simple ones like "put on your shoes"—as a profound threat to their autonomy, triggering a fight, flight, or freeze response.</p>
        <p>Understanding this is key. The behavior you see is the result of anxiety, not a desire to be difficult. The goal is not to force compliance, but to reduce anxiety and create a "felt sense of safety" so your child can re-engage with the world willingly.</p>
      </div>
    ),
  },
  {
    id: 'give-over-get',
    title: "The 'Give Over Get' Mindset: Authenticity is Key",
    content: (
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>Declarative language can feel like a "magic trick," but it's crucial to understand it is not a tool for manipulation. If you use these phrases with the hidden goal of getting your child to do something, they will sense the inauthenticity. This can damage trust.</p>
        <p>The core mindset is "Give over Get." You are GIVING information, GIVING your thoughts, and GIVING control back to your child. You are not trying to GET them to comply.</p>
        <p>For example, instead of saying, "Your hands look dirty," (which implies "go wash them"), try "I'm heading to the sink to wash my hands for dinner." You are authentically sharing your own plan. This invites your child to join you without placing a demand on them.</p>
        <p>Authenticity builds the trust and connection that is the foundation for everything else.</p>
      </div>
    ),
  },
  {
    id: 'declarative-vs-imperative',
    title: 'Declarative vs. Imperative Language',
    content: (
      <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>Understanding the difference between these two language styles is the first step.</p>
        <h3 className="font-semibold text-slate-800">Imperative Language (Commands):</h3>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Tells someone what to do.</li>
          <li>Often starts with a verb.</li>
          <li>Creates a power dynamic (speaker has power, listener must comply).</li>
          <li>Examples: "Brush your teeth," "Stop yelling," "Get your coat."</li>
        </ul>
        <h3 className="font-semibold text-slate-800">Declarative Language (Comments):</h3>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>Shares information, thoughts, or observations.</li>
          <li>Invites collaboration and problem-solving.</li>
          <li>Reduces pressure and gives the listener autonomy.</li>
          <li>Examples: "I notice your toothbrush is in the cup," "It's getting chilly in here," "I'm getting ready to leave."</li>
        </ul>
      </div>
    ),
  },
    {
    id: 'cheat-sheet',
    title: "Declarative Language 'Cheat Sheet'",
    content: (
       <div className="space-y-4 text-slate-700 leading-relaxed">
        <p>Here are some common patterns and sentence stems to help you get started:</p>
        <h3 className="font-semibold text-slate-800">Observations:</h3>
        <p>Simply state what you see, without judgment or expectation.</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>"I notice..." (e.g., "...the toast is ready.")</li>
          <li>"I see..." (e.g., "...your backpack is on the floor.")</li>
          <li>"It looks like..." (e.g., "...it might rain.")</li>
        </ul>

        <h3 className="font-semibold text-slate-800">Thinking Aloud / Self-Narration:</h3>
        <p>Share your own thoughts and plans.</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>"I'm thinking about..." (e.g., "...what to have for lunch.")</li>
          <li>"I'm going to..." (e.g., "...start getting my shoes on.")</li>
          <li>"I wonder..." (e.g., "...how we'll get this tidied up before grandma arrives.")</li>
        </ul>

        <h3 className="font-semibold text-slate-800">Collaboration / Invitation:</h3>
        <p>Frame things as a team effort.</p>
        <ul className="list-disc list-inside space-y-2 pl-4">
          <li>"Let's..." (e.g., "...see if we can get out the door in 5 minutes.")</li>
          <li>"We could..." (e.g., "...try tackling that homework together.")</li>
        </ul>
      </div>
    ),
  },
];