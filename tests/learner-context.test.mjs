import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearLearnerPath,
  learnerPathLabel,
  normalizeLearnerPath,
  normalizeStartingPoint,
  readLearnerContext,
  readLearnerPath,
  writeLearnerPath,
} from '../src/lib/learner-context.js';
import { STORAGE_KEYS, setStorageCompatibility } from '../src/lib/storage.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
    this.failGet = false;
    this.failSet = false;
    this.failRemove = false;
  }
  getItem(key) {
    if (this.failGet) throw new Error('blocked read');
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failSet) throw new Error('blocked write');
    this.values.set(key, String(value));
  }
  removeItem(key) {
    if (this.failRemove) throw new Error('blocked remove');
    this.values.delete(key);
  }
}

test('learner paths accept legacy raw bytes without rewriting them', () => {
  const placement = JSON.stringify({ level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' });
  const storage = new MemoryStorage({
    [STORAGE_KEYS.path]: 'children',
    [STORAGE_KEYS.placementResult]: placement,
  });
  const before = Object.fromEntries(storage.values);

  assert.equal(normalizeLearnerPath('children'), 'children');
  assert.equal(normalizeLearnerPath('"adults"'), 'adults');
  assert.equal(normalizeLearnerPath('teachers'), null);
  assert.equal(readLearnerPath(storage), 'children');
  assert.equal(learnerPathLabel('children'), 'Children');
  assert.deepEqual(readLearnerContext(storage), {
    path: 'children',
    startingPoint: { level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' },
  });
  assert.deepEqual(Object.fromEntries(storage.values), before);
});

test('explicit learner path writes preserve the raw string contract', () => {
  const storage = new MemoryStorage({
    [STORAGE_KEYS.placementResult]: JSON.stringify({ choice: null, answers: { q1: 'q1-yes' } }),
  });

  assert.equal(writeLearnerPath(storage, 'adults'), true);
  assert.equal(storage.getItem(STORAGE_KEYS.path), 'adults');
  assert.equal(clearLearnerPath(storage), true);
  assert.equal(storage.getItem(STORAGE_KEYS.path), null);
  assert.notEqual(storage.getItem(STORAGE_KEYS.placementResult), null);
});

test('invalid, blocked, and read-only path changes fail closed', () => {
  const invalid = new MemoryStorage();
  assert.equal(writeLearnerPath(invalid, 'teachers'), false);
  assert.equal(invalid.getItem(STORAGE_KEYS.path), null);

  const blocked = new MemoryStorage({ [STORAGE_KEYS.path]: 'children' });
  blocked.failSet = true;
  assert.equal(writeLearnerPath(blocked, 'adults'), false);
  assert.equal(blocked.getItem(STORAGE_KEYS.path), 'children');
  blocked.failSet = false;
  blocked.failRemove = true;
  assert.equal(clearLearnerPath(blocked), false);
  assert.equal(blocked.getItem(STORAGE_KEYS.path), 'children');

  const readOnly = new MemoryStorage({ [STORAGE_KEYS.path]: 'children' });
  setStorageCompatibility(readOnly, { writable: false });
  assert.equal(writeLearnerPath(readOnly, 'adults'), false);
  assert.equal(clearLearnerPath(readOnly), false);
  assert.equal(readOnly.getItem(STORAGE_KEYS.path), 'children');
});

test('learner context rejects malformed starting points and blocked reads', () => {
  assert.equal(normalizeStartingPoint({ level: 'L9', title: 'Unknown', reason: 'No.' }), null);
  assert.equal(normalizeStartingPoint({ level: 'L1', title: '', reason: 'No title.' }), null);

  const storage = new MemoryStorage({
    [STORAGE_KEYS.path]: 'adults',
    [STORAGE_KEYS.placementResult]: JSON.stringify({ choice: 'bad', answers: [] }),
  });
  assert.deepEqual(readLearnerContext(storage), { path: 'adults', startingPoint: null });
  storage.failGet = true;
  assert.deepEqual(readLearnerContext(storage), { path: null, startingPoint: null });
});
