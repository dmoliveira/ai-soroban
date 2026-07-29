import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROGRESS_STORAGE_KEYS,
  STORAGE_KEYS,
  clearProgressStorage,
  firstIncompletePlanStep,
  normalizePlacementState,
  normalizeStoredArray,
  normalizeStoredRecord,
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

test('valid JSON with the wrong storage shape normalizes safely', () => {
  assert.deepEqual(normalizeStoredArray({ 0: 'not-an-array' }), []);
  assert.deepEqual(normalizeStoredArray('not-an-array'), []);
  assert.deepEqual(normalizeStoredArray([1, 2]), [1, 2]);
  assert.deepEqual(normalizeStoredRecord(['not-a-record']), {});
  assert.deepEqual(normalizeStoredRecord('not-a-record'), {});
  assert.deepEqual(normalizeStoredRecord({ saved: true }), { saved: true });
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
    setItem: (key, value) => values.set(key, value),
  };

  const result = clearProgressStorage(storage);

  PROGRESS_STORAGE_KEYS.forEach((key) => assert.equal(values.has(key), false, key));
  assert.equal(values.get(STORAGE_KEYS.theme), 'sakura');
  assert.equal(values.get('unrelated:key'), 'keep');
  assert.equal(result.complete, true);
  assert.equal(result.broadcast, true);
  assert.ok(values.get(STORAGE_KEYS.resetEpoch));
});

test('progress reset reports keys blocked by browser storage', () => {
  const blocked = STORAGE_KEYS.masteryEvidence;
  const storage = {
    removeItem: (key) => { if (key === blocked) throw new Error('blocked'); },
    setItem: () => {},
  };
  const result = clearProgressStorage(storage);
  assert.equal(result.complete, false);
  assert.deepEqual(result.failedKeys, [blocked]);
  assert.equal(result.broadcast, false);
});

test('progress reset exposes a failed sibling-tab notification', () => {
  const storage = {
    removeItem: () => {},
    setItem: () => { throw new Error('blocked broadcast'); },
  };
  const result = clearProgressStorage(storage);
  assert.equal(result.complete, true);
  assert.deepEqual(result.failedKeys, []);
  assert.equal(result.broadcast, false);
});
