import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CHALLENGE_DEFINITIONS,
  buildChallengeQuestions,
  canonicalizeChallengeSession,
  certifyChallengeQuestions,
  evaluateChallengeOutcome,
} from '../src/lib/challenges.js';

const responseFor = (question, overrides = {}) => ({
  input: String(question.answer),
  verified: true,
  attempts: 1,
  hintsUsed: 0,
  revealedFinal: false,
  revealedSteps: false,
  recoveryUsed: false,
  recoveryMode: false,
  correct: false,
  ...overrides,
});

test('every challenge is deterministic and certifies its exact rule', () => {
  Object.keys(CHALLENGE_DEFINITIONS).forEach((challengeKey) => {
    const first = buildChallengeQuestions({ challengeKey, seed: 'fixed-seed' });
    const second = buildChallengeQuestions({ challengeKey, seed: 'fixed-seed' });
    assert.deepEqual(first, second, challengeKey);
    assert.equal(certifyChallengeQuestions(challengeKey, first).valid, true, challengeKey);
  });
});

test('different seeds change each challenge family with seeded variation', () => {
  for (const challengeKey of ['bead-match', 'clean-five', 'streak-sprint', 'sign-switch-relay', 'table-ladder', 'quotient-chase', 'anzan-burst']) {
    const signatures = new Set(['alpha', 'bravo', 'charlie', 'delta'].map((seed) => JSON.stringify(buildChallengeQuestions({ challengeKey, seed }))));
    assert.ok(signatures.size > 1, challengeKey);
  }
});

test('certification rejects tampered structured rules and answers', () => {
  const table = structuredClone(buildChallengeQuestions({ challengeKey: 'table-ladder', seed: 'table' }));
  table[4].challengeData.factor = 99;
  assert.equal(certifyChallengeQuestions('table-ladder', table).valid, false);

  const relay = structuredClone(buildChallengeQuestions({ challengeKey: 'sign-switch-relay', seed: 'relay' }));
  relay[0].challengeData.terms[2].operator = relay[0].challengeData.terms[1].operator;
  relay[0].answer = relay[0].challengeData.terms.reduce((total, term, index) => index === 0 ? term.value : term.operator === '-' ? total - term.value : total + term.value, 0);
  assert.equal(certifyChallengeQuestions('sign-switch-relay', relay).valid, false);

  const quotient = structuredClone(buildChallengeQuestions({ challengeKey: 'quotient-chase', seed: 'quotient' }));
  quotient[0].answer += 1;
  assert.equal(certifyChallengeQuestions('quotient-chase', quotient).valid, false);
});

test('challenge outcome recomputes answers and enforces first-check integrity', () => {
  const questions = buildChallengeQuestions({ challengeKey: 'bead-match', seed: 'outcome' });
  const passing = Object.fromEntries(questions.slice(0, 8).map((question, index) => [index, responseFor(question)]));
  assert.equal(evaluateChallengeOutcome({ challengeKey: 'bead-match', questions, responses: passing }).met, true);

  const failing = { ...passing };
  failing[0] = responseFor(questions[0], { attempts: 2 });
  failing[1] = responseFor(questions[1], { revealedFinal: true });
  failing[2] = responseFor(questions[2], { recoveryUsed: true });
  failing[3] = responseFor(questions[3], { input: String(questions[3].answer + 1), correct: true });
  const outcome = evaluateChallengeOutcome({ challengeKey: 'bead-match', questions, responses: failing });
  assert.equal(outcome.met, false);
  assert.equal(outcome.value, 4);
});

test('streak target passes and fails at the exact boundary', () => {
  const questions = buildChallengeQuestions({ challengeKey: 'streak-sprint', seed: 'streak' });
  const eight = Object.fromEntries(questions.slice(0, 8).map((question, index) => [index, responseFor(question)]));
  assert.deepEqual(
    (({ met, value, threshold }) => ({ met, value, threshold }))(evaluateChallengeOutcome({ challengeKey: 'streak-sprint', questions, responses: eight })),
    { met: true, value: 8, threshold: 8 },
  );
  eight[3] = responseFor(questions[3], { input: '' });
  assert.equal(evaluateChallengeOutcome({ challengeKey: 'streak-sprint', questions, responses: eight }).met, false);
});

test('saved challenge sessions restore canonical questions and outcome from key and seed', () => {
  const questions = buildChallengeQuestions({ challengeKey: 'bead-match', seed: 'saved-seed' });
  const responses = Object.fromEntries(questions.slice(0, 8).map((question, index) => [index, responseFor(question)]));
  const tampered = {
    id: 'saved-id',
    challengeKey: 'bead-match',
    challengeSeed: 'saved-seed',
    completed: true,
    questions: questions.map((question) => ({ ...question, prompt: `Answer: ${question.answer}`, steps: [`Answer: ${question.answer}`] })),
    responses,
    challengeTitle: 'Forged title',
    challengeTarget: 'Forged target',
    challengeOutcome: { met: false, value: 0 },
  };

  const restored = canonicalizeChallengeSession(tampered);
  assert.deepEqual(restored.questions, questions);
  assert.equal(restored.questions.some((question) => question.prompt.startsWith('Answer:')), false);
  assert.equal(restored.challengeTitle, CHALLENGE_DEFINITIONS['bead-match'].title);
  assert.equal(restored.challengeOutcome.met, true);
  assert.equal(restored.challengeOutcome.value, 8);
});
