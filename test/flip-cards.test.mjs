import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import rawFlipCardsData from '../constants/flipCards.json' with { type: 'json' };
import {
  DEFAULT_FLIP_CARDS,
  ALL_FLIP_CATEGORIES,
  validateFlipCards,
  getFlipCardCategories,
  createFlipDeckState,
  flipCurrentCard,
  nextFlipCard,
  prevFlipCard,
  selectFlipCategory,
  shuffleFlipDeck,
  getFlipProgressText,
  shouldFlipOnKey,
  getFlipAnimationMode,
  getFlipCardViewModel,
} from '../services/flipCards.ts';

test('Flip Cards Starter Deck - ships 16 valid cards covering all 8 starter + 8 additional prompts', () => {
  assert.equal(rawFlipCardsData.length, 16);
  assert.equal(DEFAULT_FLIP_CARDS.length, 16);

  const expectedBefores = [
    'Put your shoes on now!',
    'Stop yelling!',
    'Clean your room!',
    'Eat your dinner.',
    "Hurry up, we're late!",
    'Because I said so!',
    'Stop fighting with your sister!',
    'Go to bed right now.',
    'Do your homework right now.',
    'Go brush your teeth!',
    'Turn that off immediately!',
    "Get dressed, we're leaving!",
    'Stop whining!',
    'Help me set the table this instant!',
    'Come here right now!',
    "Say you're sorry!",
  ];

  const actualBefores = DEFAULT_FLIP_CARDS.map((c) => c.before);
  assert.deepEqual(actualBefores, expectedBefores);
});

test('Test Case 1: Clicking a card flips it; the back shows the correct "after" + "why this works" without advancing the deck', () => {
  let state = createFlipDeckState(rawFlipCardsData);
  assert.equal(state.isFlipped, false);
  assert.equal(state.currentIndex, 0);

  const vmBefore = getFlipCardViewModel(state, false);
  assert.equal(vmBefore.currentCard.before, 'Put your shoes on now!');
  assert.equal(vmBefore.frontFaceAriaHidden, false);
  assert.equal(vmBefore.backFaceAriaHidden, true);

  // Flip to back
  state = flipCurrentCard(state);
  assert.equal(state.isFlipped, true);
  assert.equal(state.currentIndex, 0, 'Flipping a card must not advance the deck');

  const vmAfter = getFlipCardViewModel(state, false);
  assert.equal(vmAfter.currentCard.after, 'Shoes are waiting by the door.');
  assert.equal(
    vmAfter.currentCard.whyItWorks,
    "Notices what's ready instead of commanding — nothing to push against."
  );
  assert.equal(vmAfter.frontFaceAriaHidden, true);
  assert.equal(vmAfter.backFaceAriaHidden, false);
  assert.ok(
    vmAfter.liveAnnouncement.includes('Shoes are waiting by the door.') &&
      vmAfter.liveAnnouncement.includes(
        "Notices what's ready instead of commanding — nothing to push against."
      ),
    'Screen reader live announcement must announce the newly revealed face'
  );

  // Flip back to front
  state = flipCurrentCard(state);
  assert.equal(state.isFlipped, false);
  assert.equal(state.currentIndex, 0);
});

test('Test Case 2: Next/Prev cycle through the full deck; progress indicator stays accurate', () => {
  let state = createFlipDeckState(rawFlipCardsData);
  const total = state.filteredCards.length;
  assert.equal(total, 16);
  assert.equal(getFlipProgressText(state), 'Card 1 of 16');

  // Cycle forward through all 16 cards
  for (let i = 1; i < total; i++) {
    state = flipCurrentCard(state); // Flip before moving next to verify Next resets flip state
    assert.equal(state.isFlipped, true);

    state = nextFlipCard(state);
    assert.equal(state.currentIndex, i);
    assert.equal(state.isFlipped, false, 'Advancing card should reset flip face to front');
    assert.equal(getFlipProgressText(state), `Card ${i + 1} of ${total}`);
  }

  // Next from last card wraps to Card 1
  state = nextFlipCard(state);
  assert.equal(state.currentIndex, 0);
  assert.equal(getFlipProgressText(state), 'Card 1 of 16');

  // Prev from Card 1 wraps to Card 16
  state = prevFlipCard(state);
  assert.equal(state.currentIndex, 15);
  assert.equal(getFlipProgressText(state), 'Card 16 of 16');
});

test('Test Case 3: Shuffle reorders the deck and guarantees the active card changes immediately without altering category order', () => {
  let state = createFlipDeckState(rawFlipCardsData);
  assert.ok(state.allCards.length >= 12);

  const initialOrder = state.filteredCards.map((c) => c.id);
  const initialCategories = getFlipCardCategories(state.allCards).map((c) => c.name);
  const initialCardId = state.filteredCards[state.currentIndex].id;

  // Deterministic RNG 1
  let seed1 = 17;
  const rng1 = () => {
    seed1 = (seed1 * 16807) % 2147483647;
    return (seed1 - 1) / 2147483646;
  };
  state = shuffleFlipDeck(state, rng1);
  const firstShuffleOrder = state.filteredCards.map((c) => c.id);
  const firstShuffleCategories = getFlipCardCategories(state.allCards).map((c) => c.name);

  assert.equal(firstShuffleOrder.length, initialOrder.length);
  assert.notDeepEqual(firstShuffleOrder, initialOrder, 'First shuffle must change card order');
  assert.notEqual(
    state.filteredCards[state.currentIndex].id,
    initialCardId,
    'Active card must change immediately after shuffle'
  );
  assert.deepEqual(
    firstShuffleCategories,
    initialCategories,
    'Category filter chips order must remain stable after shuffle'
  );
  assert.equal(state.currentIndex, 0);
  assert.equal(state.isFlipped, false);

  // Deterministic RNG 2
  let seed2 = 99991;
  const rng2 = () => {
    seed2 = (seed2 * 48271) % 2147483647;
    return (seed2 - 1) / 2147483646;
  };
  const preSecondShuffleCardId = state.filteredCards[state.currentIndex].id;
  state = shuffleFlipDeck(state, rng2);
  const secondShuffleOrder = state.filteredCards.map((c) => c.id);
  const secondShuffleCategories = getFlipCardCategories(state.allCards).map((c) => c.name);

  assert.equal(secondShuffleOrder.length, initialOrder.length);
  assert.notDeepEqual(secondShuffleOrder, firstShuffleOrder, 'Second shuffle must change order from first shuffle');
  assert.notEqual(
    state.filteredCards[state.currentIndex].id,
    preSecondShuffleCardId,
    'Active card must change on every shuffle'
  );
  assert.deepEqual(
    secondShuffleCategories,
    initialCategories,
    'Category filter chips order must remain stable across multiple shuffles'
  );
});

test('Shuffle within a filtered category preserves active category and changes active card', () => {
  // Test within "Bedtime" (2 cards)
  let state = selectFlipCategory(createFlipDeckState(rawFlipCardsData), 'Bedtime');
  assert.equal(state.activeCategory, 'Bedtime');
  assert.equal(state.filteredCards.length, 2);

  for (let i = 0; i < 20; i++) {
    const prevCardId = state.filteredCards[state.currentIndex].id;
    state = shuffleFlipDeck(state);
    const newCardId = state.filteredCards[state.currentIndex].id;

    assert.equal(state.activeCategory, 'Bedtime', 'Shuffle must preserve active category filter');
    assert.notEqual(newCardId, prevCardId, 'Active card must always change to a different card');
  }

  // Test within "Mornings" (3 cards)
  state = selectFlipCategory(createFlipDeckState(rawFlipCardsData), 'Mornings');
  assert.equal(state.activeCategory, 'Mornings');
  assert.equal(state.filteredCards.length, 3);

  for (let i = 0; i < 30; i++) {
    const prevCardId = state.filteredCards[state.currentIndex].id;
    state = shuffleFlipDeck(state);
    const newCardId = state.filteredCards[state.currentIndex].id;

    assert.equal(state.activeCategory, 'Mornings', 'Shuffle must preserve active category filter');
    assert.notEqual(newCardId, prevCardId, 'Active card must always change to a different card');
  }
});

test('Test Case 4: Selecting a category filter shows only that category\'s cards with a correct count and resets mid-deck index', () => {
  let state = createFlipDeckState(rawFlipCardsData);
  const categories = getFlipCardCategories(state.allCards);

  // Verify no empty categories ever appear
  for (const chip of categories) {
    assert.ok(chip.count > 0, `Category "${chip.name}" should have count > 0`);
  }

  // Advance mid-deck and flip card before filtering
  state = nextFlipCard(nextFlipCard(nextFlipCard(state)));
  state = flipCurrentCard(state);
  assert.equal(state.currentIndex, 3);
  assert.equal(state.isFlipped, true);

  // Select "Mornings" category
  const morningsChip = categories.find((c) => c.name === 'Mornings');
  assert.ok(morningsChip, 'Expected Mornings category chip');

  state = selectFlipCategory(state, 'Mornings');
  assert.equal(state.activeCategory, 'Mornings');
  assert.equal(state.currentIndex, 0, 'Selecting a filter mid-deck must reset to card 1');
  assert.equal(state.isFlipped, false, 'Selecting a filter mid-deck must reset flip state');
  assert.equal(state.filteredCards.length, morningsChip.count);
  assert.equal(getFlipProgressText(state), `Card 1 of ${morningsChip.count}`);
  assert.ok(state.filteredCards.every((c) => c.category === 'Mornings'));

  // Selecting All restores full deck
  state = selectFlipCategory(state, ALL_FLIP_CATEGORIES);
  assert.equal(state.filteredCards.length, 16);
  assert.equal(getFlipProgressText(state), 'Card 1 of 16');
});

test('Test Case 5: With prefers-reduced-motion enabled, flipping swaps faces without 3D animation', () => {
  assert.equal(getFlipAnimationMode(false), '3d');
  assert.equal(getFlipAnimationMode(true), 'fade');

  let state = createFlipDeckState(rawFlipCardsData);
  const vmStandard = getFlipCardViewModel(state, false);
  assert.equal(vmStandard.motionMode, '3d');
  assert.equal(vmStandard.dataFlipped, 'false');

  const vmReducedBefore = getFlipCardViewModel(state, true);
  assert.equal(vmReducedBefore.motionMode, 'fade');
  assert.equal(vmReducedBefore.frontFaceAriaHidden, false);
  assert.equal(vmReducedBefore.backFaceAriaHidden, true);

  state = flipCurrentCard(state);
  const vmReducedAfter = getFlipCardViewModel(state, true);
  assert.equal(vmReducedAfter.motionMode, 'fade');
  assert.equal(vmReducedAfter.dataFlipped, 'true');
  assert.equal(vmReducedAfter.frontFaceAriaHidden, true);
  assert.equal(vmReducedAfter.backFaceAriaHidden, false);

  // Verify CSS file contains reduced-motion rules disabling 3D transform
  const cssContent = fs.readFileSync(path.resolve('index.css'), 'utf8');
  assert.ok(
    cssContent.includes('@media (prefers-reduced-motion: reduce)') &&
      cssContent.includes('.flip-card-inner[data-motion="fade"]'),
    'index.css must include prefers-reduced-motion and data-motion="fade" rules that disable 3D rotation'
  );
});

test('Test Case 6: Keyboard: tab to a card, press Enter (or Space), card flips', () => {
  assert.equal(shouldFlipOnKey('Enter'), true);
  assert.equal(shouldFlipOnKey(' '), true);
  assert.equal(shouldFlipOnKey('Spacebar'), true);
  assert.equal(shouldFlipOnKey('Tab'), false);
  assert.equal(shouldFlipOnKey('Escape'), false);

  let state = createFlipDeckState(rawFlipCardsData);
  if (shouldFlipOnKey('Enter')) {
    state = flipCurrentCard(state);
  }
  assert.equal(state.isFlipped, true);

  const componentSource = fs.readFileSync(
    path.resolve('components/BeforeAfterFlipCards.tsx'),
    'utf8'
  );
  assert.ok(
    componentSource.includes('role="button"') &&
      componentSource.includes('tabIndex={0}') &&
      componentSource.includes('onKeyDown={handleCardKeyDown}'),
    'BeforeAfterFlipCards must render a focusable card with role="button", tabIndex={0}, and keyboard handler'
  );
});

test('Test Case 7: Removing one field from a card logs a warning and skips it without breaking the deck; duplicate IDs warn and render once', () => {
  const warnings = [];
  const customWarn = (msg) => warnings.push(msg);

  const validCard1 = { ...rawFlipCardsData[0] };
  const validCard2 = { ...rawFlipCardsData[1] };

  // Card missing `whyItWorks`
  const incompleteCard = { ...rawFlipCardsData[2] };
  delete incompleteCard.whyItWorks;

  // Duplicate ID card
  const duplicateIdCard = {
    ...rawFlipCardsData[3],
    id: validCard1.id,
  };

  const mixedInput = [validCard1, incompleteCard, duplicateIdCard, validCard2];
  const state = createFlipDeckState(mixedInput, customWarn);

  assert.equal(state.allCards.length, 2, 'Should keep only the 2 valid unique cards');
  assert.equal(state.allCards[0].id, validCard1.id);
  assert.equal(state.allCards[1].id, validCard2.id);
  assert.equal(getFlipProgressText(state), 'Card 1 of 2');

  assert.equal(warnings.length, 2, 'Should log 1 warning for missing field and 1 for duplicate id');
  assert.ok(
    warnings[0].includes('whyItWorks'),
    `Expected warning to mention missing field "whyItWorks", got: ${warnings[0]}`
  );
  assert.ok(
    warnings[1].includes('Duplicate card id'),
    `Expected warning to mention duplicate card id, got: ${warnings[1]}`
  );
});
