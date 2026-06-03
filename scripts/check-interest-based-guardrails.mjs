import assert from 'node:assert/strict';

import { applyCalibratedDecision } from './evaluator-calibration-utils.mjs';

function decisionFor(translations, text = 'Pick up your toys and put them away upstairs in your room') {
  return applyCalibratedDecision({
    id: 'interest-guardrail-example',
    text,
    tone: 'Interest Based',
    interest: 'Pokemon',
    useFewerWords: false,
    translations: translations.map((translation) => ({ translation })),
    evaluation: {
      setSummary: {
        bestOptionCount: translations.length,
        excellentOptionCount: 1,
        shouldNotShowOptionCount: 0,
        seriousMismatchOptionCount: 0,
        setVerdict: 'Pass',
      },
      optionEvaluations: translations.map((translation, index) => ({
        index: index + 1,
        translation,
        usable: true,
        excellent: index === 0,
        shouldNotShow: false,
        seriousMismatch: false,
      })),
    },
  });
}

assert.equal(
  decisionFor([
    'Looks like these toys are ready to go back to their Pokemon Center in your room.',
    'These toys can travel upstairs like a careful Pokemon route.',
    'The upstairs room is the next checkpoint for these toys, Pokemon-map style.',
  ]).verdict,
  'Fail',
  'Interest Based should fail when an option invents Pokemon-themed storage.',
);

assert.equal(
  decisionFor([
    'Pokemon toys, upstairs to your room?',
    'These toys can travel upstairs like a careful Pokemon route.',
    'The upstairs room is the next checkpoint for these toys, Pokemon-map style.',
  ]).verdict,
  'Fail',
  'Interest Based should fail when an option renames generic toys as Pokemon toys.',
);

assert.equal(
  decisionFor([
    'These toys can travel upstairs like a careful Pokemon route.',
    'The upstairs room is the next checkpoint for these toys, Pokemon-map style.',
    'A Snorlax-slow trip, Pokemon-style, could get toys upstairs.',
  ]).verdict,
  'Pass',
  'Grounded Interest Based comparisons should still be allowed.',
);

assert.equal(
  decisionFor([
    "Inside the house, we're on a trainer's walking route. Running speed fits outside.",
    'Inside walking steps can be like careful Eevee steps. Running speed fits outside.',
    'Inside, we are at walking speed, like when we are looking for Pokemon. Running is for outside.',
  ], 'Stop running in the house').verdict,
  'Pass',
  'Interest Based should allow recognizable Pokemon elements such as trainer route and Eevee.',
);

assert.equal(
  decisionFor([
    'Toys upstairs. Our Pokemon trainer route.',
    'Upstairs, for toys. A careful Pokemon route.',
    'These toys can take the Trainer path upstairs.',
  ]).verdict,
  'Pass',
  'Interest Based should allow Pokemon route language when it maps to movement, not fake storage.',
);

assert.equal(
  decisionFor([
    'Toys upstairs. Our Pokemon trainer route.',
    'Upstairs, for toys. A Poke-stop path in your room.',
    'These toys can take the Trainer path upstairs.',
  ]).verdict,
  'Fail',
  'Interest Based cleanup should fail Poke-stop wording because it behaves like a false cleanup label.',
);

assert.equal(
  decisionFor([
    'Toy team, upstairs to your room?',
    'Pokemon-style route for toys: up to your room.',
    'Moving toys upstairs, like a new checkpoint.',
  ]).verdict,
  'Fail',
  'Interest Based should fail when an option omits the interest or a recognizable element from it.',
);

assert.equal(
  decisionFor([
    'A quick wash-up, as fast as Pikachu, before dinner downstairs.',
    'Pokemon-style wash-up before dinner downstairs.',
    'Hands clean for dinner downstairs, Pokemon-style.',
  ], 'Please come down and wash your hands. It is dinner time.').verdict,
  'Pass',
  'Interest Based should allow a recognizable Pokemon element when it logically connects to the task.',
);

assert.equal(
  decisionFor([
    'Downstairs for Pokemon-style wash-up, then dinner.',
    'Dinner ready. Time for Pokemon clean hands.',
    'Pokemon route: downstairs, sink, dinner.',
  ], 'Please come down and wash your hands. It is dinner time.').verdict,
  'Fail',
  'Interest Based should fail when the interest becomes a false label for hands.',
);

assert.equal(
  decisionFor([
    'The sink is like Squirtle, washing our hands before dinner.',
    'The sink is our next Poke-stop before we are ready to eat dinner.',
    'Squirtle-style water stop, then dinner downstairs.',
  ], 'Please come down and wash your hands. It is dinner time.').verdict,
  'Pass',
  'Interest Based should allow meaningful Pokemon elements that logically connect to the task.',
);

assert.equal(
  decisionFor([
    'Pokemon quick stop: hands, then dinner.',
    'Dinner ready. Pokemon hands first.',
    'Pokemon, sink, dinner.',
  ], 'Please come down and wash your hands. It is dinner time.').verdict,
  'Fail',
  'Interest Based should fail bare Pokemon name-drops that do not logically integrate the interest.',
);

console.log('Interest Based guardrail checks passed.');
