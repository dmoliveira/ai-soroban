import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CURATED_PRACTICE_BANK,
  buildCuratedPracticeQuestions,
  buildGeneratedPracticeQuestions,
  buildJourneyPracticeQuestions,
  preparePracticeResponseForAdvance,
} from '../src/lib/practice.js';

test('curated practice stays deterministic and truthful to every selected level', () => {
  for (const level of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']) {
    const first = buildCuratedPracticeQuestions(level, 20, `curated-${level}`);
    const second = buildCuratedPracticeQuestions(level, 20, `curated-${level}`);

    assert.deepEqual(first, second);
    assert.equal(first.length, 20);
    assert.ok(first.every((question) => question.level === level));
    assert.ok(first.every((question, index) => question.id === `curated-${level}-c-${index}`));
    assert.ok(first.every((question) => question.progressKey.startsWith('curated-')));
    assert.ok(first.every((question) => Number.isFinite(question.answer) && question.steps.length > 0));
  }

  assert.ok(CURATED_PRACTICE_BANK.filter(({ level }) => level === 'L3').length >= 4);
  assert.ok(CURATED_PRACTICE_BANK.filter(({ level }) => level === 'L4').length >= 4);
  assert.throws(() => buildCuratedPracticeQuestions('L9', 5, 'unsupported'), /no curated practice bank/i);
});

test('curated question copies cannot mutate the shared authored bank', () => {
  const questions = buildCuratedPracticeQuestions('L3', 1, 'copy-check');
  const originalStep = questions[0].steps[0];
  questions[0].steps[0] = 'mutated outside the bank';

  const rebuilt = buildCuratedPracticeQuestions('L3', 1, 'copy-check');
  assert.equal(rebuilt[0].steps[0], originalStep);
});

test('extracted generated and journey builders retain deterministic question contracts', () => {
  for (const level of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5']) {
    const options = level === 'L4' ? ['mixed', '3', 'division'] : ['mixed', 'auto', null];
    const first = buildGeneratedPracticeQuestions(level, 8, `generated-${level}`, ...options);
    const second = buildGeneratedPracticeQuestions(level, 8, `generated-${level}`, ...options);
    assert.deepEqual(first, second);
    assert.ok(first.every((question) => Number.isFinite(question.answer)));
    assert.ok(first.every((question) => question.id.startsWith(`g-${level}-`)));
    if (level === 'L4') assert.ok(first.every((question) => question.skill === 'division'));
  }

  for (const journey of ['foundations', 'complements', 'fluency', 'muldiv', 'mastery']) {
    const first = buildJourneyPracticeQuestions(journey, 8, `journey-${journey}`);
    const second = buildJourneyPracticeQuestions(journey, 8, `journey-${journey}`);
    assert.deepEqual(first, second);
    assert.notEqual(first[0].steps, first[first.length - 1].steps);
  }
  const repeatedJourney = buildJourneyPracticeQuestions('fluency', 4, 'journey-copy');
  assert.notEqual(repeatedJourney[0].steps, repeatedJourney[3].steps);
});

test('advance keeps only an unchanged verified response verified', () => {
  const evidence = { attemptId: 'attempt-1' };
  const base = { input: '12', verified: true, correct: true, attempts: 1, evidence };

  assert.deepEqual(preparePracticeResponseForAdvance(base, ' 12 '), base);
  assert.deepEqual(preparePracticeResponseForAdvance(base, '13'), {
    ...base,
    input: '13',
    verified: false,
    correct: false,
  });
  assert.deepEqual(preparePracticeResponseForAdvance({ input: '', verified: false, correct: false }, '9'), {
    input: '9',
    verified: false,
    correct: false,
  });
  assert.deepEqual(preparePracticeResponseForAdvance({ input: '', verified: true, correct: false, revealedFinal: true }, ''), {
    input: '',
    verified: true,
    correct: false,
    revealedFinal: true,
  });
  assert.deepEqual(base, { input: '12', verified: true, correct: true, attempts: 1, evidence });
});
