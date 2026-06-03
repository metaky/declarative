export const VALID_VERDICTS = new Set(['Pass', 'Borderline', 'Fail']);

export function normalizeVerdict(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pass' || normalized === 'good' || normalized === 'excellent') return 'Pass';
  if (normalized === 'pass with reservations' || normalized === 'borderline' || normalized === 'borderline pass') return 'Borderline';
  if (normalized === 'weak' || normalized === 'fail' || normalized === 'failure') return 'Fail';
  return null;
}

export function verdictRank(verdict) {
  if (verdict === 'Fail') return 0;
  if (verdict === 'Borderline') return 1;
  if (verdict === 'Pass') return 2;
  return -1;
}

export function minVerdict(left, right) {
  return verdictRank(left) <= verdictRank(right) ? left : right;
}

export function getWordStats(row) {
  const counts = (row.translations ?? [])
    .map((translation) => translation.wordCount ?? String(translation.translation ?? '').trim().split(/\s+/).filter(Boolean).length)
    .filter((count) => Number.isFinite(count));
  if (!counts.length) return { average: 0, max: 0 };
  return {
    average: counts.reduce((sum, count) => sum + count, 0) / counts.length,
    max: Math.max(...counts),
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGuardrailText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/é/g, 'e')
    .toLowerCase();
}

function hasCleanupDestination(text) {
  const normalized = normalizeGuardrailText(text);
  return /\b(pick up|put\b.*\baway|clean|cleanup|toys?|blocks?|clothes?)\b/.test(normalized)
    && /\b(upstairs|room|bedroom|closet|shelf|basket|bin|drawer)\b/.test(normalized);
}

function hasRecognizableInterestElement(text, interest) {
  if (text.includes(interest)) return true;

  if (interest === 'pokemon') {
    return /\b(?:pikachus?|squirtles?|charmanders?|bulbasaurs?|eevees?|meowths?|slowpokes?|snorlaxes?|jigglypuffs?|dittos?|ash|trainers?|pokedex|pokestops?|poke-stops?|poke stops?|poke\s*ball|gym|evolutions?)\b/.test(text);
  }

  return false;
}

export function getInterestBasedGroundingIssues(row) {
  if (row.tone !== 'Interest Based' || !row.interest) return [];

  const original = normalizeGuardrailText(row.text);
  const interest = normalizeGuardrailText(row.interest);
  const interestPattern = escapeRegex(interest);
  const realTaskNouns = [
    'toy',
    'toys',
    'thing',
    'things',
    'item',
    'items',
    'hand',
    'hands',
    'dinner',
    'sink',
    'room',
    'floor',
    'house',
    'storage',
    'spot',
  ];
  const taskNounPattern = realTaskNouns.join('|');
  const renamedTaskObject = new RegExp(`\\b${interestPattern}\\s+(?:${taskNounPattern})\\b`, 'i');
  const caregiverAlreadyNamedInterestObject = new RegExp(`\\b${interestPattern}\\s+(?:${taskNounPattern})\\b`, 'i').test(original);
  const cleanupDestination = hasCleanupDestination(row.text);
  const mealHandwashing = /\b(dinner|lunch|breakfast|eat|food)\b/.test(original) && /\b(hand|hands|wash|sink)\b/.test(original);
  const pokemonInventedCleanupPlace = /\b(?:poke\s*ball|pokemon center|pokemon habitat|proper gym)\b/i;
  const pokemonCleanupFalseLabel = /\b(?:pokestops?|poke-stops?|poke stops?)\b/i;
  const falseHandwashingLabel = new RegExp(`\\b${interestPattern}(?:\\s*[- ]\\s*(?:level|strong))?\\s+(?:clean\\s+)?hands?\\b`, 'i');
  const barePokemonMealNameDrop = /\bpokemon(?:\s+quick\s+stop|[,:\s]+(?:sink|hands?|dinner)\b)/i;

  return (row.translations ?? []).flatMap((translation, index) => {
    const text = normalizeGuardrailText(translation.translation);
    const issues = [];

    if (!hasRecognizableInterestElement(text, interest)) {
      issues.push({
        index: index + 1,
        reason: `does not include "${row.interest}" or a recognizable element from it`,
      });
    }

    if (!caregiverAlreadyNamedInterestObject && renamedTaskObject.test(text)) {
      issues.push({
        index: index + 1,
        reason: `renames a real task object as ${row.interest}`,
      });
    }

    if (interest === 'pokemon' && cleanupDestination && pokemonInventedCleanupPlace.test(text)) {
      issues.push({
        index: index + 1,
        reason: 'turns the cleanup destination into an invented Pokemon place/object',
      });
    }

    if (interest === 'pokemon' && cleanupDestination && pokemonCleanupFalseLabel.test(text)) {
      issues.push({
        index: index + 1,
        reason: 'uses Poke-stop as a false cleanup label instead of a route/checkpoint comparison',
      });
    }

    if (mealHandwashing && falseHandwashingLabel.test(text)) {
      issues.push({
        index: index + 1,
        reason: `uses ${row.interest} as a false label for hands`,
      });
    }

    if (interest === 'pokemon' && mealHandwashing && barePokemonMealNameDrop.test(text)) {
      issues.push({
        index: index + 1,
        reason: 'uses Pokemon as a bare name-drop instead of a logical meal/handwashing connection',
      });
    }

    return issues;
  });
}

export function applyCalibratedDecision(row) {
  const summary = row.evaluation?.setSummary ?? {};
  let verdict = normalizeVerdict(summary.setVerdict ?? row.evaluation?.verdict) ?? 'Fail';
  const reasons = [];
  const optionEvaluations = row.evaluation?.optionEvaluations ?? [];
  const evaluatedUsableCount = optionEvaluations.filter((option) => option.usable === true).length;
  const evaluatedExcellentCount = optionEvaluations.filter((option) => option.excellent === true).length;
  const bestOptionCount = Math.max(Number(summary.bestOptionCount ?? 0), evaluatedUsableCount);
  const excellentOptionCount = Math.max(Number(summary.excellentOptionCount ?? 0), evaluatedExcellentCount);
  const shouldNotShowCount = Number(summary.shouldNotShowOptionCount ?? summary.harmfulOptionCount ?? 0);
  const seriousMismatchCount = Number(summary.seriousMismatchOptionCount ?? 0);
  const interestGroundingIssues = getInterestBasedGroundingIssues(row);
  const stats = getWordStats(row);
  const isRunningSafety = /\brunn?ing\b|\brun\b/i.test(row.text ?? '');

  if (shouldNotShowCount > 0) {
    verdict = 'Fail';
    reasons.push('should-not-show option present');
  }

  if (bestOptionCount === 0) {
    verdict = 'Fail';
    reasons.push('model reported zero usable options');
  } else if (bestOptionCount === 1 && excellentOptionCount === 0 && verdict === 'Pass') {
    verdict = 'Borderline';
    reasons.push('one non-excellent usable option caps set at Borderline');
  }

  if (row.useFewerWords) {
    if (stats.average >= 14.5 || stats.max >= 18) {
      verdict = 'Fail';
      reasons.push(`Fewer Words too long (avg ${stats.average.toFixed(1)}, max ${stats.max})`);
    } else if (stats.average >= 12 || stats.max >= 16) {
      if (isRunningSafety) {
        verdict = minVerdict(verdict, 'Borderline');
        reasons.push(`Fewer Words borderline length for safety redirection (avg ${stats.average.toFixed(1)}, max ${stats.max})`);
      } else {
        verdict = 'Fail';
        reasons.push(`Fewer Words too long for transition/cleanup (avg ${stats.average.toFixed(1)}, max ${stats.max})`);
      }
    }
  }

  if (row.tone === 'Interest Based' && row.interest && seriousMismatchCount > 0) {
    verdict = 'Fail';
    reasons.push(`Interest Based option missed required interest integration (${seriousMismatchCount} mismatch${seriousMismatchCount === 1 ? '' : 'es'})`);
  } else if (interestGroundingIssues.length > 0) {
    verdict = 'Fail';
    reasons.push(`Interest Based grounding issue (${interestGroundingIssues.length} option${interestGroundingIssues.length === 1 ? '' : 's'}: ${interestGroundingIssues.map((issue) => `#${issue.index} ${issue.reason}`).join('; ')})`);
  } else if ((row.tone === 'Interest Based' || row.tone === 'Equalizing') && seriousMismatchCount >= 2) {
    verdict = minVerdict(verdict, bestOptionCount >= 2 ? 'Borderline' : 'Fail');
    reasons.push(`${row.tone} serious mismatch count ${seriousMismatchCount}`);
  }

  if (row.tone === 'Interest Based' && (row.interestMissing || (!row.interest && row.id?.includes('interest-missing')))) {
    verdict = 'Fail';
    reasons.push('Interest Based selected without an interest value in calibration case');
  }

  return { verdict, reasons };
}
