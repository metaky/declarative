import assert from 'node:assert/strict';
import test from 'node:test';
import { scanDemand, isNonEnglishText } from '../services/demandRadar.ts';

test('Demand Radar - Test Case 1: "Put your shoes on now"', () => {
  const input = 'Put your shoes on now';
  const result = scanDemand(input);

  const imperativeSignal = result.signals.find((s) => s.category === 'imperative');
  assert.ok(imperativeSignal, 'Should flag imperative');
  assert.equal(imperativeSignal.phrase, 'Put your shoes on');
  assert.equal(imperativeSignal.severity, 'strong');

  const urgencySignal = result.signals.find((s) => s.category === 'urgency');
  assert.ok(urgencySignal, 'Should flag urgency');
  assert.equal(urgencySignal.phrase.toLowerCase(), 'now');
  assert.equal(urgencySignal.severity, 'mild');

  assert.ok(result.score >= 70, `Expected score >= 70, got ${result.score}`);
  assert.ok(['Demanding', 'High demand'].includes(result.label));
});

test('Demand Radar - Test Case 2: "Stop yelling"', () => {
  const input = 'Stop yelling';
  const result = scanDemand(input);

  const stopSignals = result.signals.filter((s) => s.phrase.toLowerCase() === 'stop');
  assert.ok(stopSignals.length >= 2, 'Should flag Stop for multiple categories');

  const hasImperative = stopSignals.some((s) => s.category === 'imperative' && s.severity === 'strong');
  const hasNegative = stopSignals.some((s) => s.category === 'negative' && s.severity === 'strong');

  assert.ok(hasImperative, 'Should flag Stop as imperative strong');
  assert.ok(hasNegative, 'Should flag Stop as negative framing strong');
});

test('Demand Radar - Test Case 3: "Could you please put your shoes on when you\'re ready?"', () => {
  const input = "Could you please put your shoes on when you're ready?";
  const result = scanDemand(input);

  const hasStrong = result.signals.some((s) => s.severity === 'strong');
  assert.equal(hasStrong, false, 'Should have no strong flags');
  assert.ok(result.score <= 25, `Expected score <= 25, got ${result.score}`);
  assert.equal(result.label, 'Gentle');
  assert.equal(result.hasPositiveDeclarativeMarkers, true);
});

test('Demand Radar - Test Case 4: "Toothbrushes are waiting on the sink."', () => {
  const input = 'Toothbrushes are waiting on the sink.';
  const result = scanDemand(input);

  assert.equal(result.signals.length, 0, 'Expected zero flags');
  assert.equal(result.score, 0, 'Expected score 0');
  assert.equal(result.label, 'Gentle');
  assert.equal(result.isEmpty, false);
  assert.equal(result.hasPositiveDeclarativeMarkers, true);
});

test('Demand Radar - Test Case 5: "How many times do I have to tell you to clean your room?"', () => {
  const input = 'How many times do I have to tell you to clean your room?';
  const result = scanDemand(input);

  const rhetoricalSignal = result.signals.find((s) => s.category === 'rhetorical');
  assert.ok(rhetoricalSignal, 'Should flag rhetorical pressure question');
  assert.equal(rhetoricalSignal.severity, 'strong');
  assert.ok(result.score >= 80, `Expected score >= 80, got ${result.score}`);
  assert.equal(result.label, 'High demand');
});

test('Demand Radar - Test Case 6: Typing then deleting text updates highlights and score within ~300ms simulation', async () => {
  let currentText = '';
  let radarResult = scanDemand(currentText);
  assert.equal(radarResult.isEmpty, true);
  assert.equal(radarResult.score, 0);

  currentText = 'Put your shoes on now';
  await new Promise((resolve) => setTimeout(resolve, 300));
  radarResult = scanDemand(currentText);
  assert.ok(radarResult.score >= 70);
  assert.equal(radarResult.signals.length, 2);

  currentText = '';
  await new Promise((resolve) => setTimeout(resolve, 300));
  radarResult = scanDemand(currentText);
  assert.equal(radarResult.isEmpty, true);
  assert.equal(radarResult.score, 0);
  assert.equal(radarResult.signals.length, 0);
});

test('Demand Radar - 40-statement parent validation corpus covers short, medium, long, and subtle demands', () => {
  const demandingStatements = [
    // Short / Clipped (1-3 words)
    'Shoes on',
    'Brush teeth',
    'Bedtime',
    'Clean up',
    'In the car',
    'Inside voice',
    'Quiet please',
    'No hitting',
    'Pajamas on',
    'Eat dinner',
    'Hands washed',
    'Homework time',
    // Obligation & I-Statements
    'I need you to be quiet',
    "It's bed time and I need you to put away your ipad",
    'You have to eat at least three bites before you get down',
    'We need to leave in five minutes',
    'Mommy needs you to hold my hand in the parking lot',
    "You're supposed to be getting dressed right now",
    "Let's put the toys away",
    // Direct & Chained
    'Put your shoes on now',
    'Turn off YouTube',
    'Stop throwing the blocks',
    'Go upstairs, brush your teeth, and put your pajamas on',
    'Don’t touch the stove',
    'Get out of the bath',
    // Long / Escalated
    "I've asked you three times already to put your dishes in the sink and you're still sitting there",
    "If you don't get out of the bath right now we won't have time for stories tonight",
    'We are going to be late for school because you never get your shoes on when I ask',
    'Why do we have to fight about brushing teeth every single night?',
    'Everyone else is already in the car waiting for you, come on',
    'First finish cleaning up these Legos, then you can have screen time',
    'How many times do I have to tell you to clean your room?',
    // Disguised / Subtle / Praise-pressure
    'Can you please come sit at the table?',
    'Are you ready to turn off the TV?',
    'Good listeners keep their hands to themselves',
    'Big kids use the potty before we leave',
    'You are being way too loud right now. Please stop.',
  ];

  for (const statement of demandingStatements) {
    const res = scanDemand(statement);
    assert.ok(
      res.signals.length > 0 && res.score >= 30,
      `Expected demanding statement "${statement}" to be flagged, but got score=${res.score}`
    );
  }

  const gentleControls = [
    'Toothbrushes are waiting on the sink.',
    "Could you please put your shoes on when you're ready?",
    'I wonder if the blue shoes or the red shoes feel better today.',
    'I wonder if we need to bring jackets.',
    "Dinner's ready.",
  ];

  for (const statement of gentleControls) {
    const res = scanDemand(statement);
    assert.equal(res.signals.length, 0, `Expected gentle control "${statement}" to have 0 flags`);
    assert.equal(res.score, 0);
    assert.equal(res.hasPositiveDeclarativeMarkers, true);
  }
});

test('Demand Radar - Dismissing / ignoring signals stops highlighting that span', () => {
  const input = 'Put your shoes on now';
  const initial = scanDemand(input);
  assert.equal(initial.signals.length, 2);

  const ignored = new Set(['urgency:now']);
  const afterIgnore = scanDemand(input, ignored);

  assert.equal(afterIgnore.signals.length, 1);
  assert.equal(afterIgnore.signals[0].category, 'imperative');

  ignored.add('imperative:put your shoes on');
  const allIgnored = scanDemand(input, ignored);
  assert.equal(allIgnored.signals.length, 0);
  assert.equal(allIgnored.score, 0);
  assert.equal(allIgnored.label, 'Gentle');
});

test('Demand Radar - Multi-sentence input scans each sentence independently', () => {
  const input = 'Toothbrushes are waiting on the sink. Put your shoes on now.';
  const result = scanDemand(input);

  assert.equal(result.signals.length, 2);
  const imp = result.signals.find((s) => s.category === 'imperative');
  assert.ok(imp);
  assert.equal(imp.phrase, 'Put your shoes on');
  assert.equal(input.slice(imp.start, imp.end), 'Put your shoes on');
});

test('Demand Radar - Non-English input detection', () => {
  const spanishInput = 'Por favor pon tus zapatos ahora';
  assert.equal(isNonEnglishText(spanishInput), true);

  const result = scanDemand(spanishInput);
  assert.equal(result.isNonEnglish, true);
  assert.equal(result.signals.length, 0);
});
