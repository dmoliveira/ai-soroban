import test from 'node:test';
import assert from 'node:assert/strict';

import {
  digitToRodState,
  numberToSorobanState,
  normalizeStepTimeline,
  pressLowerBead,
  rodStateToDigit,
  sorobanStateToNumber,
  toggleUpperBead,
} from '../src/lib/soroban.js';

test('every decimal digit round trips through a legal 1:4 rod state', () => {
  for (let digit = 0; digit <= 9; digit += 1) {
    assert.equal(rodStateToDigit(digitToRodState(digit)), digit);
  }
  assert.throws(() => rodStateToDigit({ upperActive: true, lowerActive: 5 }), /invalid/i);
});

test('multi-rod values round trip without trusting display strings', () => {
  for (const value of [0, 7, 10, 31, 508, 9999]) {
    assert.equal(sorobanStateToNumber(numberToSorobanState(value)), value);
  }
});

test('native bead actions keep state legal and deterministic', () => {
  let state = digitToRodState(0);
  state = toggleUpperBead(state);
  state = pressLowerBead(state, 3);
  assert.deepEqual(state, { upperActive: true, lowerActive: 3 });
  assert.equal(rodStateToDigit(state), 8);
  assert.deepEqual(pressLowerBead(state, 2), { upperActive: true, lowerActive: 1 });
});

test('authored chronology stays ordered and appends the final value only when absent', () => {
  assert.deepEqual(normalizeStepTimeline([24, 31, 32], 32), [24, 31, 32]);
  assert.deepEqual(normalizeStepTimeline([30], 31), [30, 31]);
  assert.deepEqual(normalizeStepTimeline([8, 6, 6], 6), [8, 6]);
});
