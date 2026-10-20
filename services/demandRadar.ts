/**
 * Demand Radar: PDA-aware demand signal detector and coaching engine.
 * Scans statements for explicit and indirect demand patterns:
 * - Bare & chained imperatives ("Put your shoes on", "Go upstairs, brush your teeth")
 * - Clipped / telegraphic commands ("Shoes on", "Bedtime", "In the car", "Inside voice")
 * - Adult-centered & obligation frames ("I need you to...", "Mommy needs you to...", "I've asked you...", "You have to...", "Let's...")
 * - Urgency & transition triggers ("now", "right now", "we're going to be late", "it's bedtime")
 * - Disguised question-demands & rhetorical pressure ("Why do we have to...", "Can you...", "Are you ready to...")
 * - Comparisons, praise-pressure & behavioral judgments ("Good listeners...", "Big kids...", "Everyone else is...", "You're being...")
 * - Ultimatums & first/then contingencies ("If you don't...", "First..., then...")
 */

export type DemandCategory =
  | 'imperative'
  | 'urgency'
  | 'absolute'
  | 'threat'
  | 'negative'
  | 'rhetorical';

export type DemandSeverity = 'mild' | 'strong';

export interface DemandSignal {
  id: string;
  start: number;
  end: number;
  phrase: string;
  category: DemandCategory;
  severity: DemandSeverity;
  label?: string;
  note: string;
}

export type DemandTier = 'gentle' | 'firm' | 'demanding' | 'high_demand';

export interface DemandScoreResult {
  score: number;
  label: 'Gentle' | 'Firm' | 'Demanding' | 'High demand';
  tier: DemandTier;
}

export interface DemandRadarResult {
  signals: DemandSignal[];
  score: number;
  label: 'Gentle' | 'Firm' | 'Demanding' | 'High demand';
  tier: DemandTier;
  isNonEnglish: boolean;
  isEmpty: boolean;
  hasPositiveDeclarativeMarkers: boolean;
}

export const CATEGORY_METADATA: Record<
  DemandCategory,
  {
    name: string;
    icon: string;
    underlineStyle: string;
    bgStyle: string;
    borderStyle: string;
    badgeStyle: string;
    defaultNote: string;
  }
> = {
  imperative: {
    name: 'Imperative / Direct Demand',
    icon: 'command',
    underlineStyle: 'underline decoration-solid decoration-amber-500 decoration-2 underline-offset-4',
    bgStyle: 'bg-amber-100 text-amber-950',
    borderStyle: 'border-amber-300',
    badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultNote:
      "Direct commands and obligation phrases ('put...', 'I need you to...') remove autonomy and can trigger a PDA fight-or-flight response before the child can process the request.",
  },
  urgency: {
    name: 'Urgency / Time Pressure',
    icon: 'clock',
    underlineStyle: 'underline decoration-dashed decoration-orange-500 decoration-2 underline-offset-4',
    bgStyle: 'bg-orange-100 text-orange-950',
    borderStyle: 'border-orange-300',
    badgeStyle: 'bg-orange-50 text-orange-800 border-orange-200',
    defaultNote:
      'Time pressure and agenda transitions spike adrenaline and perceived threat, making it harder for a child’s nervous system to shift gears.',
  },
  absolute: {
    name: 'Absolute',
    icon: 'scale',
    underlineStyle: 'underline decoration-dotted decoration-indigo-500 decoration-2 underline-offset-4',
    bgStyle: 'bg-indigo-100 text-indigo-950',
    borderStyle: 'border-indigo-300',
    badgeStyle: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultNote:
      "Words like 'always' or 'never' feel all-or-nothing and accusatory, triggering defensive pushback rather than connection.",
  },
  threat: {
    name: 'Ultimatum / Contingency',
    icon: 'shield-alert',
    underlineStyle: 'underline decoration-double decoration-rose-500 decoration-2 underline-offset-4',
    bgStyle: 'bg-rose-100 text-rose-950',
    borderStyle: 'border-rose-300',
    badgeStyle: 'bg-rose-50 text-rose-800 border-rose-200',
    defaultNote:
      'Ultimatums and conditional contingencies signal that safety or privileges are at stake, which corners the nervous system into a survival response.',
  },
  negative: {
    name: 'Negative / Evaluative Framing',
    icon: 'ban',
    underlineStyle: 'underline decoration-wavy decoration-red-500 decoration-2 underline-offset-4',
    bgStyle: 'bg-red-100 text-red-950',
    borderStyle: 'border-red-300',
    badgeStyle: 'bg-red-50 text-red-800 border-red-200',
    defaultNote:
      "Telling a child what not to do or criticizing their state ('stop', 'don't', 'too loud') increases mental load and shame without showing a safe path forward.",
  },
  rhetorical: {
    name: 'Pressure Question',
    icon: 'help-circle',
    underlineStyle: 'underline decoration-wavy decoration-purple-600 decoration-2 underline-offset-4',
    bgStyle: 'bg-purple-100 text-purple-950',
    borderStyle: 'border-purple-300',
    badgeStyle: 'bg-purple-50 text-purple-800 border-purple-200',
    defaultNote:
      'Rhetorical or compliance questions feel like shaming or a trap where "no" is not a safe answer, putting a PDA nervous system into instant defense.',
  },
};

/**
 * Normalize curly quotes/apostrophes (from iOS/macOS keyboards) to straight ASCII apostrophes
 * while preserving exact string length so character offsets remain 1:1 with the input text.
 */
function normalizeQuotesKeepLength(text: string): string {
  return text.replace(/[\u2018\u2019\u02BC`]/g, "'");
}

// 1. Rhetorical shaming / pressure questions
const RHETORICAL_PATTERNS: Array<{ regex: RegExp; severity: DemandSeverity; note?: string }> = [
  {
    regex: /\b(how many times do i have to|why can't you just|why cant you just|why is it so hard to|do i have to do everything|are you even listening to me|are you listening to me|what is wrong with you|why do you always|why do we have to|why won't you|why aren't you|can't you just|cant you just|how many times have i told you|how many times have i said|did you hear what i said|did you hear me)\b/gi,
    severity: 'strong',
    note: 'Rhetorical questions feel like shaming or entrapment with no safe answer, putting a PDA nervous system into instant high defense.',
  },
];

// 2. Ultimatums / threats / conditional contingencies
const THREAT_PATTERNS: Array<{ regex: RegExp; severity: DemandSeverity; note?: string }> = [
  {
    regex: /\b(or else|if you don't|if you do not|do it or|you better|or you won't|or you will not|or no [a-z]+|unless you want to lose|or you can't|or you're losing|or i'm taking|or i will take|last warning|i'm not asking again|i am not asking again|on the count of (?:three|3)|1,?\s*2,?\s*3)\b/gi,
    severity: 'strong',
    note: 'Ultimatums and countdowns trigger an acute threat response because they make safety, time, or privileges feel under attack.',
  },
  {
    regex: /\b(no [a-z]+ until you [a-z\s]+|first [a-z0-9\s]{2,45},\s*then (?:you can|we can|we'll|you'll|[a-z]+)|as soon as you [a-z\s]{2,35},\s*you can)\b/gi,
    severity: 'strong',
    note: 'First/then contingencies and conditional rewards still register to a PDA nervous system as external control, often escalating resistance.',
  },
];

// 3. Urgency & agenda transition markers
const URGENCY_PATTERNS: Array<{ regex: RegExp; severity: DemandSeverity; note?: string }> = [
  {
    regex: /\b(right now|immediately|this instant|this second|this minute|at once|chop chop|asap|hurry up|we're late|we are late|we're going to be late|we are going to be late|you're going to be late|you are going to be late)\b/gi,
    severity: 'strong',
    note: 'Strong time pressure spikes adrenaline and perceived threat, making transitions feel like emergencies rather than manageable steps.',
  },
  {
    regex: /\b(now|hurry|quickly|let's go|lets go|come on|faster|straight away|before it gets too late|right away)\b/gi,
    severity: 'mild',
    note: 'Time pressure spikes adrenaline and perceived demand, making it harder for an overwhelmed nervous system to transition.',
  },
  {
    regex: /\b(it's bed\s*time|it is bed\s*time|it's dinner\s*time|it is dinner\s*time|it's bath\s*time|it is bath\s*time|it's [0-9]+(?:\s*o'clock)?|time for bed|time for dinner|time for school|time for bath|time to leave|time to go|homework time|bath\s*time|bed\s*time|dinner\s*time)\b/gi,
    severity: 'mild',
    note: 'Announcing an agenda transition can feel abrupt when a child’s focus is anchored elsewhere; pairing it with low-pressure setup helps soften the shift.',
  },
];

// 4. Absolutes
const ABSOLUTE_PATTERNS: Array<{ regex: RegExp; severity: DemandSeverity }> = [
  { regex: /\b(every single time|every single night|every single day|never)\b/gi, severity: 'strong' },
  { regex: /\b(always|every time|constantly|all the time)\b/gi, severity: 'mild' },
];

// 5. Imperative & Obligation Command Verbs
const IMPERATIVE_VERBS = new Set([
  'put', 'go', 'come', 'sit', 'eat', 'brush', 'clean', 'hurry',
  'listen', 'look', 'take', 'give', 'get', 'pick', 'stand', 'wash',
  'finish', 'tell', 'leave', 'drop', 'pack', 'turn', 'bring', 'hand',
  'move', 'wait', 'wear', 'close', 'open', 'drink', 'say', 'show', 'hold',
  'grab', 'head', 'start', 'do', 'make', 'use', 'keep', 'help', 'check',
  'find', 'throw', 'hang', 'tie', 'zip', 'button', 'buckle', 'share',
  'apologize', 'try', 'focus', 'stay', 'step', 'walk', 'sleep', 'wake',
  'read', 'write', 'practice', 'clear', 'wipe', 'dry', 'rinse', 'flush',
  'comb', 'dress', 'change', 'feed', 'calm', 'settle', 'quiet', 'slow',
  'hush', 'be',
]);

// Words that end a verb phrase span so urgency markers or next clauses are separate
const VERB_PHRASE_BOUNDARY_REGEX =
  /(?:,\s*|\s+(now|right now|immediately|quickly|asap|at once|hurry|before it gets too late|and\b|or\b|so\b|because\b|while\b|when\b|if\b|[.!?;]))/i;

// Positive declarative / autonomy markers
const POSITIVE_DECLARATIVE_REGEX =
  /\b(is waiting|are waiting|is ready|are ready|'s ready|i wonder|i'm wondering|i am wondering|i notice|i'm noticing|i am noticing|it looks like|when you're ready|when you are ready|whenever you're ready|if you'd like|if you want|can wait|is open|are on the|is on the)\b/i;

export function isNonEnglishText(text: string): boolean {
  if (!text.trim()) return false;
  const nonLatinRegex =
    /[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F]/;
  if (nonLatinRegex.test(text)) return true;

  const nonEnglishWords =
    /\b(por favor|s'il vous plaît|s'il vous plait|bitte|bonjour|hola|danke|merci|buenos días|buenas tardes)\b/i;
  return nonEnglishWords.test(normalizeQuotesKeepLength(text));
}

interface SentenceSpan {
  text: string;
  start: number;
  end: number;
}

export function splitIntoSentenceSpans(fullText: string): SentenceSpan[] {
  const spans: SentenceSpan[] = [];
  const sentenceRegex = /[^.!?\n]+(?:[.!?]+|\n|$)/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(fullText)) !== null) {
    const raw = match[0];
    if (!raw.trim()) continue;

    const leadingWhitespace = raw.match(/^\s*/)?.[0].length || 0;
    const trailingWhitespace = raw.match(/\s*$/)?.[0].length || 0;

    const start = match.index + leadingWhitespace;
    const end = match.index + raw.length - trailingWhitespace;
    const trimmedText = fullText.slice(start, end);

    if (trimmedText) {
      spans.push({ text: trimmedText, start, end });
    }
  }

  return spans;
}

function extractClausePhrase(text: string, startIndex: number): string {
  const slice = text.slice(startIndex);
  const boundaryMatch = VERB_PHRASE_BOUNDARY_REGEX.exec(slice);
  const endRel = boundaryMatch && boundaryMatch.index !== undefined ? boundaryMatch.index : slice.length;
  return slice.slice(0, endRel).replace(/[.!?,;]+$/, '').trim();
}

/**
 * Scan an individual sentence independently.
 */
function scanSentence(
  rawSentenceText: string,
  sentenceOffset: number,
  ignoredKeys: Set<string>
): DemandSignal[] {
  const sentenceText = normalizeQuotesKeepLength(rawSentenceText);
  const signals: DemandSignal[] = [];
  const trimmed = sentenceText.trim();
  if (!trimmed) return signals;

  const makeId = (category: DemandCategory, phrase: string, start: number) =>
    `${category}:${phrase.toLowerCase()}:${start}`;

  const isIgnored = (category: DemandCategory, phrase: string) => {
    const key = `${category}:${phrase.toLowerCase().trim()}`;
    return ignoredKeys.has(key);
  };

  const addSignal = (
    category: DemandCategory,
    phrase: string,
    localStart: number,
    severity: DemandSeverity,
    note?: string,
    allowSameSpanDifferentCategory = false
  ) => {
    const cleanLen = phrase.replace(/[.!?,;]+$/, '').trim().length;
    if (cleanLen === 0) return;

    // Slice from original rawSentenceText so original typography (e.g. curly apostrophes) is preserved
    const exactPhrase = rawSentenceText.slice(localStart, localStart + cleanLen);
    if (isIgnored(category, normalizeQuotesKeepLength(exactPhrase))) return;

    const globalStart = sentenceOffset + localStart;
    const globalEnd = globalStart + exactPhrase.length;

    const duplicate = signals.some((s) => {
      if (allowSameSpanDifferentCategory && s.category !== category) return false;
      const overlaps = Math.max(s.start, globalStart) < Math.min(s.end, globalEnd);
      return overlaps && (s.category === category || !allowSameSpanDifferentCategory);
    });

    if (!duplicate) {
      signals.push({
        id: makeId(category, exactPhrase, globalStart),
        start: globalStart,
        end: globalEnd,
        phrase: exactPhrase,
        category,
        severity,
        note: note || CATEGORY_METADATA[category].defaultNote,
      });
    }
  };

  const hasAutonomyClause =
    /\b(when you're ready|when you are ready|if you'd like|if you want|whenever you're ready)\b/i.test(
      sentenceText
    );
  const isDeclarativeWonderOrNotice =
    /^(?:i wonder|i'm wondering|i am wondering|i notice|i'm noticing|i am noticing)\b/i.test(trimmed);
  const isPoliteConditionalModal =
    (/^(could|would)\s+(you|we)\s+(please\s+)?/i.test(trimmed) && hasAutonomyClause) ||
    isDeclarativeWonderOrNotice;

  // 1. Rhetorical pressure questions (if matched, flags whole sentence and skips sub-clause imperative noise inside it)
  let isWholeSentenceRhetorical = false;
  for (const { regex, severity, note } of RHETORICAL_PATTERNS) {
    regex.lastIndex = 0;
    const match = regex.exec(sentenceText);
    if (match) {
      addSignal('rhetorical', sentenceText.trim(), 0, severity, note);
      isWholeSentenceRhetorical = true;
    }
  }

  // 2. Disguised question-demands ("Can you be quiet?", "Are you ready to turn off the TV?", "Will you...")
  if (!isWholeSentenceRhetorical && !isPoliteConditionalModal && !hasAutonomyClause && /\?\s*$/.test(trimmed)) {
    const disguisedQRegex =
      /^(can you|will you|won't you|could you|would you|are you going to|are you ready to|did you|have you)\s+(?:please\s+|just\s+)?([a-z]+.*)$/i;
    const qMatch = disguisedQRegex.exec(trimmed);
    if (qMatch) {
      const leadSpace = sentenceText.indexOf(trimmed);
      addSignal(
        'rhetorical',
        trimmed,
        leadSpace >= 0 ? leadSpace : 0,
        'mild',
        'Questions where "no" isn\'t truly an option ("Can you...", "Are you ready to...") often register to a PDA child as a disguised demand. Sharing an observation or adding genuine autonomy lowers the pressure.'
      );
      isWholeSentenceRhetorical = true;
    }
  }

  // 3. Ultimatums / threats / first-then contingencies
  for (const { regex, severity, note } of THREAT_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sentenceText)) !== null) {
      addSignal('threat', match[0], match.index, severity, note);
    }
  }

  // 4. Adult-centered & Obligation Demand Frames:
  // Includes "I need you to...", "Mommy/Daddy/Mom/Dad needs/wants you to...", "I've asked you [X times] to...", "You have to...", "Let's [verb]..."
  if (!isWholeSentenceRhetorical && !isPoliteConditionalModal) {
    const obligationFrameRegex =
      /\b((?:i|mom|mommy|dad|daddy|mama|papa)\s+(?:need|needs|want|wants|expect|expects|asked|told)\s+you\s+to|(?:i've|i have|i already)\s+(?:asked|told)\s+you(?:\s+[a-z0-9\s]{1,25})?\s+to|i'd like you to|i would like you to|i'm asking you to|you need to|you have to|you've got to|you must|you should|you're supposed to|you are supposed to|you're going to|you are going to|we need to|we have to|we've got to|we must|it's time to|it is time to|time to|let's|lets)\s+(?!go\b)([a-z]+)/gi;

    let obMatch: RegExpExecArray | null;
    while ((obMatch = obligationFrameRegex.exec(sentenceText)) !== null) {
      const phrase = extractClausePhrase(sentenceText, obMatch.index);
      const opener = obMatch[1].toLowerCase();
      const isAdultNeed = /^(i|mom|mommy|dad|daddy|mama|papa)\b/.test(opener);
      const isRepeatedAsk = /\b(asked|told)\b/.test(opener);
      const isLets = /^(let's|lets)$/.test(opener);
      const isTimeStatement = opener.includes('time to');

      const customNote = isRepeatedAsk
        ? "Reminding a child that you've already asked or told them amplifies shame and threat, making it even harder for a PDA nervous system to comply."
        : isAdultNeed
        ? "Phrasing a command as 'I need you to...' or 'Mommy needs you to...' still removes choice, and adds emotional weight by making the child feel responsible for the adult's need."
        : isLets
        ? "While 'Let's...' sounds collaborative to adults, when it directs a child's task ('Let's put the toys away') it often registers as a disguised command."
        : isTimeStatement
        ? "Announcing 'It's time to...' signals an adult-imposed agenda shift, which can trigger immediate resistance if the child isn't ready to transition."
        : "Obligation phrases like 'you have to' or 'we need to' frame the action as non-negotiable, triggering the same autonomy threat as a direct command.";

      addSignal('imperative', phrase, obMatch.index, isLets ? 'mild' : 'strong', customNote);
    }
  }

  // 5. Negative framing, Behavioral Criticisms, Comparisons & Praise-Pressure:
  // "Stop" -> flags both negative framing (strong) + imperative (strong) per Test Case 2
  const stopMatch = /\b(stop)\b/i.exec(sentenceText);
  if (stopMatch && stopMatch.index !== undefined && !isPoliteConditionalModal) {
    addSignal('negative', stopMatch[0], stopMatch.index, 'strong', CATEGORY_METADATA.negative.defaultNote, true);
    addSignal('imperative', stopMatch[0], stopMatch.index, 'strong', CATEGORY_METADATA.imperative.defaultNote, true);
  }

  const negativePatterns: Array<{ regex: RegExp; note?: string }> = [
    {
      regex: /\b(don't|dont|do not)\s+[a-z]+(?:\s+[a-z]+){0,3}/gi,
      note: "Telling a child what not to do ('don't...') increases cognitive load and triggers resistance without offering a safe, clear alternative.",
    },
    {
      regex: /\b(no\s+more\s+[a-z]+|no\s+[a-z]+ing|quit\s+[a-z]+ing|that's enough|enough\s+[a-z]+ing)\b/gi,
      note: "Shutdown phrases ('no more...', 'no running') feel restrictive and abrupt to a PDA nervous system.",
    },
    {
      regex: /\b(you are being|you're being|you're still|you are still)\s+(?:way\s+|so\s+|too\s+|very\s+)*[a-z]+(?:\s+[a-z]+){0,2}/gi,
      note: "Evaluative statements about a child's behavior ('you are being...', 'you're still sitting there') can trigger shame and immediate defensiveness.",
    },
    {
      regex: /\b(it makes (?:me|mom|mommy|dad|daddy) (?:sad|upset|mad|angry|frustrated)|your (?:sister|brother|friend) (?:is already|already has)|everyone (?:else )?is (?:already )?[a-z\s]{3,25}?waiting for you)\b/gi,
      note: 'Emotional guilt or comparisons ("everyone else is waiting") create intense internal pressure and shame, often escalating PDA distress.',
    },
    {
      regex: /\b(good (?:listeners|kids|boys|girls|helpers)|big (?:kids|boys|girls))\s+[a-z]+(?:\s+[a-z]+){0,4}/gi,
      note: "Praise-pressure ('Good listeners...', 'Big kids...') implies that autonomy or struggling makes the child 'bad' or 'little,' which triggers strong PDA pushback.",
    },
  ];

  for (const { regex, note } of negativePatterns) {
    regex.lastIndex = 0;
    let negMatch: RegExpExecArray | null;
    while ((negMatch = regex.exec(sentenceText)) !== null) {
      const phrase = extractClausePhrase(sentenceText, negMatch.index) || negMatch[0];
      addSignal('negative', phrase, negMatch.index, 'strong', note);
    }
  }

  // 6. Urgency markers
  for (const { regex, severity, note } of URGENCY_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sentenceText)) !== null) {
      addSignal('urgency', match[0], match.index, severity, note);
    }
  }

  // 7. Absolutes
  for (const { regex, severity } of ABSOLUTE_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(sentenceText)) !== null) {
      addSignal('absolute', match[0], match.index, severity);
    }
  }

  // 8. Imperatives (Sentence-initial AND mid-sentence after conjunctions/commas)
  if (!isWholeSentenceRhetorical && !isPoliteConditionalModal && !hasAutonomyClause) {
    const clauseStartsRegex = /(?:^|(?:,\s*(?:and\s+|then\s+)?|\b(?:and|then|so)\s+))(?:please\s+|just\s+|first\s+)?([a-z]+)\b/gi;
    let clauseMatch: RegExpExecArray | null;

    while ((clauseMatch = clauseStartsRegex.exec(sentenceText)) !== null) {
      const candidateVerb = clauseMatch[1].toLowerCase();
      if (!IMPERATIVE_VERBS.has(candidateVerb) || candidateVerb === 'stop') {
        continue;
      }

      const fullMatchText = clauseMatch[0];
      const verbOffsetInMatch = fullMatchText.toLowerCase().lastIndexOf(candidateVerb);
      const pleaseOffsetInMatch = fullMatchText.toLowerCase().indexOf('please ');
      const phraseStartInSentence =
        pleaseOffsetInMatch !== -1
          ? clauseMatch.index + pleaseOffsetInMatch
          : clauseMatch.index + verbOffsetInMatch;

      if (candidateVerb === 'be') {
        const afterBe = sentenceText.slice(clauseMatch.index + verbOffsetInMatch);
        if (!/^be\s+(quiet|still|nice|careful|good|gentle|patient|polite|quick|ready|calm|kind|silent|done)\b/i.test(afterBe)) {
          continue;
        }
      }

      const verbPhrase = extractClausePhrase(sentenceText, phraseStartInSentence);
      if (verbPhrase) {
        addSignal('imperative', verbPhrase, phraseStartInSentence, 'strong');
      }
    }
  }

  // 9. Short / Clipped Telegraphic Parent Commands (1-3 words with no subject/verb, e.g. "Shoes on", "Pajamas on", "In the car", "Inside voice", "Hands washed")
  if (signals.length === 0 && !hasAutonomyClause && !isPoliteConditionalModal) {
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount <= 4) {
      const clippedCommandRegex =
        /^(?:[a-z]+\s+(?:on|off|up|down|away|out|in|washed|brushed|done)|in\s+the\s+[a-z]+|to\s+bed|out\s+of\s+(?:the\s+)?[a-z]+|inside\s+voice|quiet\s+voice|walking\s+feet|gentle\s+hands|homework|teeth|shoes|pajamas|jacket|coat)$/i;
      if (clippedCommandRegex.test(trimmed.replace(/[.!?]+$/, ''))) {
        const leadSpace = sentenceText.indexOf(trimmed);
        addSignal(
          'imperative',
          trimmed,
          leadSpace >= 0 ? leadSpace : 0,
          'strong',
          'Short, clipped prompts ("Shoes on", "In the car") often sound barked or urgent to a child, which can spike threat even when you are just trying to keep words brief.'
        );
      }
    }
  }

  return signals;
}

/**
 * Calculate demand score (0-100) and plain-language tier.
 */
export function calculateDemandScore(signals: DemandSignal[]): DemandScoreResult {
  if (signals.length === 0) {
    return { score: 0, label: 'Gentle', tier: 'gentle' };
  }

  let totalScore = 0;

  const hasStrongRhetorical = signals.some((s) => s.category === 'rhetorical' && s.severity === 'strong');
  const hasImperative = signals.some((s) => s.category === 'imperative' && s.severity === 'strong');
  const hasNegative = signals.some((s) => s.category === 'negative');
  const hasUrgency = signals.some((s) => s.category === 'urgency');

  if (hasStrongRhetorical) {
    totalScore = 85;
  } else if (hasImperative && hasUrgency) {
    totalScore = 75;
  } else if (hasImperative && hasNegative) {
    totalScore = 75;
  } else {
    for (const signal of signals) {
      if (signal.severity === 'strong') {
        if (signal.category === 'imperative' || signal.category === 'threat') {
          totalScore += 55;
        } else if (signal.category === 'negative') {
          totalScore += 55;
        } else {
          totalScore += 45;
        }
      } else {
        // mild
        if (signal.category === 'rhetorical' || signal.category === 'imperative') {
          totalScore += 40;
        } else if (signal.category === 'urgency' || signal.category === 'threat') {
          totalScore += 30;
        } else {
          totalScore += 25;
        }
      }
    }
  }

  if (signals.length >= 3 && totalScore < 80) {
    totalScore = Math.max(totalScore, 80);
  }

  const score = Math.min(100, Math.max(0, Math.round(totalScore)));

  let label: 'Gentle' | 'Firm' | 'Demanding' | 'High demand';
  let tier: DemandTier;

  if (score <= 20) {
    label = 'Gentle';
    tier = 'gentle';
  } else if (score <= 50) {
    label = 'Firm';
    tier = 'firm';
  } else if (score <= 80) {
    label = 'Demanding';
    tier = 'demanding';
  } else {
    label = 'High demand';
    tier = 'high_demand';
  }

  return { score, label, tier };
}

export function scanDemand(
  text: string,
  ignoredKeys: Set<string> = new Set()
): DemandRadarResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      signals: [],
      score: 0,
      label: 'Gentle',
      tier: 'gentle',
      isNonEnglish: false,
      isEmpty: true,
      hasPositiveDeclarativeMarkers: false,
    };
  }

  if (isNonEnglishText(trimmed)) {
    return {
      signals: [],
      score: 0,
      label: 'Gentle',
      tier: 'gentle',
      isNonEnglish: true,
      isEmpty: false,
      hasPositiveDeclarativeMarkers: false,
    };
  }

  const sentenceSpans = splitIntoSentenceSpans(text);
  const allSignals: DemandSignal[] = [];

  for (const span of sentenceSpans) {
    const sentenceSignals = scanSentence(span.text, span.start, ignoredKeys);
    allSignals.push(...sentenceSignals);
  }

  allSignals.sort((a, b) => a.start - b.start || b.end - a.end);

  const { score, label, tier } = calculateDemandScore(allSignals);
  const hasPositiveDeclarativeMarkers = POSITIVE_DECLARATIVE_REGEX.test(normalizeQuotesKeepLength(trimmed));

  return {
    signals: allSignals,
    score,
    label,
    tier,
    isNonEnglish: false,
    isEmpty: false,
    hasPositiveDeclarativeMarkers,
  };
}
