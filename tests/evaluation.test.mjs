import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateResponse, normalizeEvaluationText } from '../src/lib/evaluation.js';

test('numeric evaluation accepts declared values and tolerance only', () => {
  assert.equal(evaluateResponse({ kind: 'numeric', accepted: [31] }, '31').correct, true);
  assert.equal(evaluateResponse({ kind: 'numeric', accepted: [31] }, '31.1').correct, false);
  assert.equal(evaluateResponse({ kind: 'numeric', accepted: [31], tolerance: 0.2 }, '31.1').correct, true);
  assert.equal(evaluateResponse({ kind: 'numeric', accepted: [16] }, '0x10').correct, false);
  assert.equal(evaluateResponse({ kind: 'numeric', accepted: [100] }, '1e2').correct, false);
});

test('concept evaluation accepts equivalent concise wording without exact prose', () => {
  const evaluation = {
    kind: 'concepts',
    allOf: [['beam'], ['touch', 'toward'], ['count', 'active', 'value']],
  };
  assert.equal(evaluateResponse(evaluation, 'Beads count when moved toward the beam.').correct, true);
  assert.equal(evaluateResponse(evaluation, 'The beam is horizontal.').correct, false);
  assert.equal(normalizeEvaluationText('  TOWARD—THE beam! '), 'toward the beam');
});

test('pair evaluation validates every declared complement in order', () => {
  const evaluation = {
    kind: 'pairs',
    target: 5,
    pairs: [[1, 4], [2, 3], [3, 2], [4, 1]],
  };
  assert.equal(evaluateResponse(evaluation, '1+4, 2+3, 3+2, 4+1').correct, true);
  assert.equal(evaluateResponse(evaluation, '1+4, 2+3').correct, false);
  assert.equal(evaluateResponse({ ...evaluation, pairs: [[1, 5]] }, '1+5').valid, false);
});
