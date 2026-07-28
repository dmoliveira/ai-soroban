import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROGRESS_STORAGE_KEYS,
  STORAGE_KEYS,
  clearProgressStorage,
  firstIncompletePlanStep,
  normalizePlacementState,
  parseStoredJson,
} from '../src/lib/storage.js';

test('placement state accepts both legacy and current shapes', () => {
  const legacy = { level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' };
  assert.deepEqual(normalizePlacementState(legacy), { choice: legacy, answers: {} });

  const current = { choice: legacy, answers: { q1: 'q1-yes' } };
  assert.deepEqual(normalizePlacementState(current), current);
  assert.deepEqual(normalizePlacementState({ choice: 'bad', answers: [] }), { choice: null, answers: {} });
});

test('malformed stored JSON falls back without throwing', () => {
  assert.deepEqual(parseStoredJson('{not-json', []), []);
  assert.deepEqual(parseStoredJson(null, {}), {});
});

test('weekly plan returns null only when every step is complete', () => {
  assert.equal(firstIncompletePlanStep({}), 'lesson');
  assert.equal(firstIncompletePlanStep({ lesson: { done: true } }), 'exercise');
  assert.equal(firstIncompletePlanStep({ lesson: { done: true }, exercise: { done: true }, worksheet: { done: true } }), null);
});

test('progress reset covers every learner key and preserves theme', () => {
  const values = new Map(PROGRESS_STORAGE_KEYS.map((key) => [key, 'saved']));
  values.set(STORAGE_KEYS.theme, 'sakura');
  values.set('unrelated:key', 'keep');
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => values.delete(key),
  };

  clearProgressStorage(storage);

  PROGRESS_STORAGE_KEYS.forEach((key) => assert.equal(values.has(key), false, key));
  assert.equal(values.get(STORAGE_KEYS.theme), 'sakura');
  assert.equal(values.get('unrelated:key'), 'keep');
});
