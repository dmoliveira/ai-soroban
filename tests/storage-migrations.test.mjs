import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { STORAGE_KEYS, writeStoredJson } from '../src/lib/storage.js';
import { ensureStorageCompatibility } from '../src/lib/storage-migrations.js';
import { appendEvidenceEvent, createAttemptEvidence } from '../src/lib/mastery.js';

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/storage-v0.3.json', import.meta.url), 'utf8')).values;

class MemoryStorage {
  constructor(values = {}, failKey = null, failGetKey = null) {
    this.values = new Map(Object.entries(values));
    this.failKey = failKey;
    this.failGetKey = failGetKey;
  }
  getItem(key) {
    if (key === this.failGetKey) throw new Error('blocked read');
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (key === this.failKey) throw new Error('quota');
    this.values.set(key, String(value));
  }
  removeItem(key) { this.values.delete(key); }
}

test('0.3 compatibility migration is additive, truthful, and idempotent', () => {
  const storage = new MemoryStorage(fixture);
  const legacyBefore = Object.fromEntries(storage.values);
  const first = ensureStorageCompatibility(storage, { now: '2026-07-29T00:00:00.000Z' });
  assert.equal(first.complete, true);
  Object.entries(legacyBefore).forEach(([key, value]) => assert.equal(storage.getItem(key), value, key));
  assert.equal(storage.getItem(STORAGE_KEYS.theme), 'sumi');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.masteryEvidence)), []);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.masterySeenItems)), { version: 1, claims: [] });
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.bossProvenance)).L0.source, 'legacy-unknown');
  const scores = JSON.parse(storage.getItem(STORAGE_KEYS.miniGameScoresV2));
  assert.equal(scores.legacy.scores['table-tower'], 500);
  assert.deepEqual(scores.bestByScope, {});

  const snapshot = Object.fromEntries(storage.values);
  const second = ensureStorageCompatibility(storage, { now: '2030-01-01T00:00:00.000Z' });
  assert.equal(second.complete, true);
  assert.deepEqual(Object.fromEntries(storage.values), snapshot);
});

test('partial write failure leaves the marker unwritten and retries safely', () => {
  const storage = new MemoryStorage(fixture, STORAGE_KEYS.miniGameScoresV2);
  const failed = ensureStorageCompatibility(storage, { now: '2026-07-29T00:00:00.000Z' });
  assert.equal(failed.complete, false);
  assert.equal(storage.getItem(STORAGE_KEYS.stateSchema), null);
  assert.equal(storage.getItem(STORAGE_KEYS.theme), 'sumi');

  storage.failKey = null;
  const retried = ensureStorageCompatibility(storage, { now: '2026-07-29T00:00:01.000Z' });
  assert.equal(retried.complete, true);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEYS.stateSchema)).version, 1);
});

test('malformed companions and blocked reads cannot advance the schema marker', () => {
  const malformed = new MemoryStorage({ ...fixture, [STORAGE_KEYS.masteryEvidence]: '"wrong"' });
  const malformedResult = ensureStorageCompatibility(malformed);
  assert.equal(malformedResult.complete, false);
  assert.equal(malformedResult.failedKey, STORAGE_KEYS.masteryEvidence);
  assert.equal(malformed.getItem(STORAGE_KEYS.stateSchema), null);

  const blocked = new MemoryStorage(fixture, null, STORAGE_KEYS.miniGameScores);
  const blockedResult = ensureStorageCompatibility(blocked);
  assert.equal(blockedResult.complete, false);
  assert.equal(blockedResult.failedKey, STORAGE_KEYS.miniGameScores);
  assert.equal(blocked.getItem(STORAGE_KEYS.stateSchema), null);
});

test('a lower schema marker advances only after valid companions exist', () => {
  const storage = new MemoryStorage({ ...fixture, [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 0 }) });
  const result = ensureStorageCompatibility(storage, { now: '2026-07-29T01:00:00.000Z' });
  assert.equal(result.complete, true);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.stateSchema)), { version: 1, migratedAt: '2026-07-29T01:00:00.000Z' });
});

test('the current marker heals missing companions but never blesses malformed ones', () => {
  const currentMarker = JSON.stringify({ version: 1, migratedAt: '2026-07-29T00:00:00.000Z' });
  const missing = new MemoryStorage({ ...fixture, [STORAGE_KEYS.stateSchema]: currentMarker });
  const healed = ensureStorageCompatibility(missing, { now: '2030-01-01T00:00:00.000Z' });
  assert.equal(healed.complete, true);
  assert.deepEqual(healed.written.sort(), [
    STORAGE_KEYS.bossProvenance,
    STORAGE_KEYS.masteryEvidence,
    STORAGE_KEYS.masterySeenItems,
    STORAGE_KEYS.miniGameScoresV2,
  ].sort());
  assert.equal(missing.getItem(STORAGE_KEYS.stateSchema), currentMarker);

  const malformed = new MemoryStorage({
    ...fixture,
    [STORAGE_KEYS.stateSchema]: currentMarker,
    [STORAGE_KEYS.masteryEvidence]: '"wrong"',
  });
  const rejected = ensureStorageCompatibility(malformed);
  assert.equal(rejected.complete, false);
  assert.equal(rejected.failedKey, STORAGE_KEYS.masteryEvidence);
  assert.equal(malformed.getItem(STORAGE_KEYS.stateSchema), currentMarker);
});

test('a future marker remains opaque to an older client', () => {
  const futureMarker = JSON.stringify({ version: 99, migratedAt: '2035-01-01T00:00:00.000Z' });
  const storage = new MemoryStorage({ ...fixture, [STORAGE_KEYS.stateSchema]: futureMarker });
  const snapshot = Object.fromEntries(storage.values);
  const result = ensureStorageCompatibility(storage);
  assert.equal(result.complete, true);
  assert.equal(result.writable, false);
  assert.equal(result.future, true);
  assert.equal(writeStoredJson(storage, STORAGE_KEYS.miniGameScoresV2, { version: 2 }), false);
  assert.deepEqual(Object.fromEntries(storage.values), snapshot);
});

test('lossy evidence defaults cannot establish a writable trust boundary', () => {
  const malformedAttempt = {
    version: 1,
    attemptId: 'missing-trust-facts',
    source: 'exercise',
    itemId: 'exercise-l0-001',
    skill: 'number-reading',
    level: 'L0',
    eligibility: 'prospective',
    seed: null,
    events: [{ seq: 1, kind: 'submit', value: '4', correct: true }],
  };
  const storage = new MemoryStorage({
    ...fixture,
    [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 1 }),
    [STORAGE_KEYS.masteryEvidence]: JSON.stringify([malformedAttempt]),
  });
  const result = ensureStorageCompatibility(storage);
  assert.equal(result.complete, false);
  assert.equal(result.writable, false);
  assert.equal(result.failedKey, STORAGE_KEYS.masteryEvidence);
  assert.equal(writeStoredJson(storage, STORAGE_KEYS.exerciseStates, { forged: true }), false);
  assert.equal(storage.getItem(STORAGE_KEYS.masterySeenItems), null);
});

test('a current marker heals seen-item claims from canonical evidence', () => {
  const evidence = appendEvidenceEvent(createAttemptEvidence({
    attemptId: 'evidence-owner',
    source: 'exercise',
    itemId: 'exercise-l0-001',
    skill: 'number-reading',
    level: 'L0',
    rule: { id: 'exercise-l0-001', version: 1 },
    startedAt: '2026-07-29T00:00:00.000Z',
  }), { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z' });
  const storage = new MemoryStorage({
    ...fixture,
    [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 1 }),
    [STORAGE_KEYS.masteryEvidence]: JSON.stringify([evidence]),
    [STORAGE_KEYS.masterySeenItems]: JSON.stringify({ version: 1, claims: [] }),
  });
  const result = ensureStorageCompatibility(storage);
  assert.equal(result.complete, true);
  assert.equal(result.writable, true);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEYS.masterySeenItems)).claims, [{
    itemId: 'exercise-l0-001',
    attemptId: 'evidence-owner',
    firstSeenAt: '2026-07-29T00:00:01.000Z',
  }]);
});

test('conflicting seen-item ownership keeps canonical-looking evidence read-only', () => {
  const evidence = appendEvidenceEvent(createAttemptEvidence({
    attemptId: 'prospective-attempt',
    source: 'exercise',
    itemId: 'exercise-l0-001',
    skill: 'number-reading',
    level: 'L0',
    rule: { id: 'exercise-l0-001', version: 1 },
    startedAt: '2026-07-29T00:00:00.000Z',
  }), { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z' });
  const storage = new MemoryStorage({
    ...fixture,
    [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 1 }),
    [STORAGE_KEYS.masteryEvidence]: JSON.stringify([evidence]),
    [STORAGE_KEYS.masterySeenItems]: JSON.stringify({
      version: 1,
      claims: [{ itemId: evidence.itemId, attemptId: 'different-owner', firstSeenAt: '2026-07-28T00:00:00.000Z' }],
    }),
  });
  const result = ensureStorageCompatibility(storage);
  assert.equal(result.complete, false);
  assert.equal(result.writable, false);
  assert.equal(result.failedKey, STORAGE_KEYS.masterySeenItems);
});
