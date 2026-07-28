import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MINI_GAME_DEFINITIONS,
  buildMiniGameRound,
  certifyMiniGameRound,
  createMiniGameState,
  miniGameElapsedMs,
  normalizeMiniGameSettings,
  reduceMiniGameState,
  shouldPersistMiniGameResult,
} from '../src/lib/mini-games.js';

test('finite mode defaults and bounded settings normalize exactly', () => {
  assert.deepEqual(normalizeMiniGameSettings('complement-dash'), { questionCount: 10, timeLimitSeconds: 30 });
  assert.deepEqual(normalizeMiniGameSettings('anzan-flash'), { termCount: 20, intervalMs: 1000 });
  assert.deepEqual(normalizeMiniGameSettings('table-tower'), { questionCount: 10 });
  assert.deepEqual(normalizeMiniGameSettings('error-fix'), { questionCount: 10 });
  assert.deepEqual(normalizeMiniGameSettings('complement-dash', { questionCount: 999, timeLimitSeconds: 7 }), { questionCount: 10, timeLimitSeconds: 30 });
  assert.deepEqual(normalizeMiniGameSettings('complement-dash', { questionCount: 5, timeLimitSeconds: 0 }), { questionCount: 5, timeLimitSeconds: 0 });
  assert.deepEqual(normalizeMiniGameSettings('anzan-flash', { termCount: -1, intervalMs: 20 }), { termCount: 20, intervalMs: 1000 });
});

test('every mini-game builds a deterministic certified finite round', () => {
  Object.keys(MINI_GAME_DEFINITIONS).forEach((gameId) => {
    const first = buildMiniGameRound({ gameId, tier: 'silver', seed: 'same' });
    const second = buildMiniGameRound({ gameId, tier: 'silver', seed: 'same' });
    assert.deepEqual(first, second, gameId);
    assert.equal(certifyMiniGameRound(first).valid, true, gameId);
    if (first.questions) assert.equal(first.questions.length, first.settings.questionCount, gameId);
  });
});

test('number bonds are exact and Flash Anzan keeps positive running totals', () => {
  const bonds = buildMiniGameRound({ gameId: 'complement-dash', seed: 'bonds' });
  assert.equal(bonds.questions.length, 10);
  bonds.questions.forEach((question) => assert.equal(question.data.given + question.answer, question.data.base));

  const flash = buildMiniGameRound({ gameId: 'anzan-flash', seed: 'flash' });
  assert.equal(flash.terms.length, 20);
  assert.equal(flash.settings.intervalMs, 1000);
  let total = flash.terms[0].value;
  flash.terms.slice(1).forEach((term) => {
    total = term.operator === '-' ? total - term.value : total + term.value;
    assert.ok(total > 0);
  });
  assert.equal(total, flash.answer);
});

test('question reducer consumes wrong answers and completes exactly once', () => {
  const round = buildMiniGameRound({ gameId: 'table-tower', settings: { questionCount: 5 }, seed: 'table' });
  let state = reduceMiniGameState(createMiniGameState(round), { type: 'START', now: 1000 });
  state = reduceMiniGameState(state, { type: 'SUBMIT', input: round.questions[0].answer + 1, questionIndex: 0, now: 1100 });
  assert.deepEqual({ index: state.questionIndex, answered: state.answeredCount, score: state.score, streak: state.streak }, { index: 1, answered: 1, score: 0, streak: 0 });
  for (let index = 1; index < round.questions.length; index += 1) {
    state = reduceMiniGameState(state, { type: 'SUBMIT', input: round.questions[index].answer, questionIndex: index, now: 1100 + index });
  }
  assert.equal(state.status, 'complete');
  assert.equal(state.reason, 'questions-complete');
  assert.equal(state.correctCount, 4);
  assert.equal(shouldPersistMiniGameResult(state), true);
  assert.equal(reduceMiniGameState(state, { type: 'SUBMIT', input: 1, questionIndex: 5, now: 9000 }), state);
});

test('deadline wins over a simultaneous answer and Stop never persists', () => {
  const round = buildMiniGameRound({ gameId: 'complement-dash', settings: { questionCount: 5, timeLimitSeconds: 15 }, seed: 'clock' });
  const running = reduceMiniGameState(createMiniGameState(round), { type: 'START', now: 5000 });
  const expired = reduceMiniGameState(running, { type: 'SUBMIT', input: round.questions[0].answer, questionIndex: 0, now: 20000 });
  assert.deepEqual({ reason: expired.reason, answered: expired.answeredCount, score: expired.score }, { reason: 'time-expired', answered: 0, score: 0 });
  assert.equal(shouldPersistMiniGameResult(expired), true);

  const stopped = reduceMiniGameState(running, { type: 'STOP', reason: 'stopped', now: 6000 });
  assert.equal(stopped.status, 'complete');
  assert.equal(shouldPersistMiniGameResult(stopped), false);
  assert.equal(miniGameElapsedMs(stopped), 1000);
  assert.equal(reduceMiniGameState(stopped, { type: 'TICK', now: 99999 }), stopped);
  const interrupted = reduceMiniGameState(running, { type: 'STOP', reason: 'interrupted', now: 6500 });
  assert.equal(interrupted.reason, 'interrupted');
  assert.equal(shouldPersistMiniGameResult(interrupted), false);
});

test('Flash Anzan waits for every term and accepts one terminal answer', () => {
  const round = buildMiniGameRound({ gameId: 'anzan-flash', settings: { termCount: 10, intervalMs: 500 }, seed: 'paced' });
  let state = reduceMiniGameState(createMiniGameState(round), { type: 'START', now: 0 });
  assert.equal(state.termsShown, 1);
  assert.equal(reduceMiniGameState(state, { type: 'SUBMIT', input: round.answer, now: 1 }), state);
  for (let index = 1; index < round.terms.length; index += 1) {
    state = reduceMiniGameState(state, { type: 'SHOW_FLASH_TERM', now: index * 500 });
  }
  state = reduceMiniGameState(state, { type: 'FLASH_READY', now: 5000 });
  assert.equal(state.status, 'awaiting-answer');
  const completed = reduceMiniGameState(state, { type: 'SUBMIT', input: round.answer, now: 5100 });
  assert.deepEqual({ status: completed.status, score: completed.score, correct: completed.correctCount, reason: completed.reason }, {
    status: 'complete', score: 100, correct: 1, reason: 'answer-submitted',
  });
  assert.equal(shouldPersistMiniGameResult(completed), true);
  assert.equal(reduceMiniGameState(completed, { type: 'SHOW_FLASH_TERM', now: 9999 }), completed);
});
