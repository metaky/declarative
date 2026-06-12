import React, { useEffect, useState } from 'react';
import { CheckCircleIcon, HeartIcon, ShieldIcon, StarIcon } from './icons/Icons';

type ChangelogEntry = {
  dateRange: string;
  title: string;
  summary: string;
  highlights: string[];
  tag: string;
};

type PublicStats = {
  translationsMade: number | null;
  translationsMadeTrackingStarted: string;
};

const changelogEntries: ChangelogEntry[] = [
  {
    dateRange: 'June 2-3, 2026',
    title: 'Translation quality refresh',
    summary: 'A focused pass on the translator so outputs stay practical, calm, and useful in real family moments.',
    highlights: [
      'Reviewed model outputs against a more human-centered quality rubric and calibration set.',
      'Improved prompt guidance for tone, clarity, and usable alternatives.',
      'Added repeatable quality checks so future translator changes can be tested before they go live.',
    ],
    tag: 'Quality',
  },
  {
    dateRange: 'April 30-May 3, 2026',
    title: 'Better follow-up ideas and tone handling',
    summary: 'Grouped improvements that made it easier to keep exploring alternatives after a translation, especially when the first suggestion is close but not quite right.',
    highlights: [
      'Kept the Get Ideas flow closer to the translated result.',
      'Refined equalizing tone guidance for low-pressure collaboration.',
      'Compared before-and-after examples to catch awkward phrasing.',
    ],
    tag: 'Workflow',
  },
  {
    dateRange: 'April 19-20, 2026',
    title: 'Variations and support release',
    summary: 'A set of live-site updates that made the translator more flexible and gave supporters a clearer way to help keep the project running.',
    highlights: [
      'Added one-tap variations so a single translation can turn into a few different choices without starting over.',
      'Updated donation copy around the variation release.',
      'Added monthly support alongside one-time donations.',
    ],
    tag: 'Translator',
  },
  {
    dateRange: 'April 10, 2026',
    title: 'Recent history and translator mode cleanup',
    summary: 'Made saved translations easier to understand later and cleaned up the behind-the-scenes tools used while improving prompts.',
    highlights: [
      'Saved tone-specific translation runs in Recent history.',
      'Added clearer developer tooling around translator modes and examples.',
    ],
    tag: 'History',
  },
  {
    dateRange: 'March 11, 2026',
    title: 'Reliability and app foundation',
    summary: 'A foundation release focused on making the site load reliably and feel more like a small, dependable web app.',
    highlights: [
      'Added app-style install support.',
      'Improved caching rules so deployments avoid stale blank pages.',
      'Reactivated translation features with supporting site updates.',
    ],
    tag: 'Reliability',
  },
];

const projectPrinciples = [
  'Keep the tool free and low-friction.',
  'Improve real translation usefulness, not just surface polish.',
  'Make support and privacy expectations easy to understand.',
];

const navigationCalloutHighlights = [
  'Added this changelog page as a dedicated place to explain recent site and translator improvements.',
  'Added Changelog to the top-level navigation between Learn and Other Tools on larger screens.',
  'Moved phone-sized navigation into a compact menu so Translator, Learn, Changelog, Other Tools, Share, and Support all stay easy to reach.',
];

const launchDate = new Date('2025-12-03T00:00:00');
const statsTrackingStartLabel = 'May 2026';

const TagPill: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-100">
    {children}
  </span>
);

export const ChangelogPage: React.FC = () => {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const daysLive = Math.max(0, Math.floor((Date.now() - launchDate.getTime()) / 86400000));
  const translationsMade = typeof stats?.translationsMade === 'number'
    ? new Intl.NumberFormat('en-US').format(stats.translationsMade)
    : null;

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/stats', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (!payload || typeof payload !== 'object') return;

        setStats({
          translationsMade: typeof payload.translationsMade === 'number' ? payload.translationsMade : null,
          translationsMadeTrackingStarted: typeof payload.translationsMadeTrackingStarted === 'string'
            ? payload.translationsMadeTrackingStarted
            : '2026-05-04',
        });
      })
      .catch((error) => {
        if ((error as { name?: string }).name !== 'AbortError') {
          console.warn('Could not load public stats:', error);
        }
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="w-full animate-fade-in pb-12">
      <div className="space-y-10">
        <section className="space-y-6 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl">
              Changelog
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600">
              A simple record of what is getting better: translation quality, calmer workflows, and the practical pieces that help keep the project going.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-sky-200 bg-white p-6 shadow-sm ring-1 ring-sky-50 md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <TagPill>Navigation</TagPill>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-gray-900">New changelog and mobile menu</h3>
                <p className="max-w-2xl leading-relaxed text-gray-700">
                  The site now has a clearer place for update notes, plus a cleaner phone layout that keeps the most important destinations available without squeezing the header.
                </p>
              </div>
            </div>
            <time className="text-sm font-semibold text-gray-500">June 3, 2026</time>
          </div>

          <ul className="mt-5 space-y-3 border-t border-sky-100 pt-5">
            {navigationCalloutHighlights.map((highlight) => (
              <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-gray-600">
                <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-sky-600" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Declarative App Goals
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {projectPrinciples.map((principle, index) => {
              const icons = [
                <HeartIcon className="h-5 w-5 text-rose-500" />,
                <CheckCircleIcon className="h-5 w-5 text-emerald-600" />,
                <ShieldIcon className="h-5 w-5 text-sky-600" />,
              ];

              return (
                <div key={principle} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 inline-flex rounded-full bg-gray-50 p-2">
                    {icons[index]}
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-gray-700">{principle}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Recent Updates
          </h3>
          <div className="space-y-5">
            {changelogEntries.map((entry) => (
              <article key={`${entry.dateRange}-${entry.title}`} className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <TagPill>{entry.tag}</TagPill>
                      <time className="text-sm font-semibold text-gray-500">{entry.dateRange}</time>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">{entry.title}</h3>
                      <p className="max-w-2xl leading-relaxed text-gray-700">{entry.summary}</p>
                    </div>
                  </div>
                </div>

                <ul className="mt-5 space-y-3 border-t border-gray-100 pt-5">
                  {entry.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-gray-600">
                      <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="flex flex-col items-center py-2" aria-hidden="true">
            <span className="h-8 w-px bg-gradient-to-b from-gray-200 to-gray-300"></span>
            <div className="my-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
            </div>
            <span className="h-8 w-px bg-gradient-to-b from-gray-300 to-amber-200"></span>
          </div>

          <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm md:p-7">
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
                  <StarIcon className="h-4 w-4" />
                  Launch Milestone
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Declarative App Launched</h3>
                  <p className="leading-relaxed text-gray-700">
                    December 3, 2025. Declarativeapp.org went live as a public home for calmer, more declarative phrasing.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-amber-200">
                  <p className="text-3xl font-extrabold leading-none text-amber-700">{daysLive}</p>
                  <p className="mt-2 text-sm font-bold text-amber-900">Days live</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-gray-600">Since the public site launched.</p>
                </div>
                <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-amber-200">
                  <p className="text-3xl font-extrabold leading-none text-amber-700">{translationsMade || '...'}</p>
                  <p className="mt-2 text-sm font-bold text-amber-900">Translations made</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-gray-600">Aggregate count tracked since {statsTrackingStartLabel}.</p>
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};
