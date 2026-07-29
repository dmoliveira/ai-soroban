import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildScoreSummary,
  isCanonicalScoreStore,
  medalForNormalizedScore,
  normalizeScoreStore,
  scoreScopeKey,
  storeComparableScore,
} from '../src/lib/scoring.js';

test('equivalent accuracy normalizes identically across round lengths', () => {
  const five = buildScoreSummary({ mode: 'table-tower', tier: 'starter', ruleVersion: 1, settings: { questionCount: 5 }, rawPoints: 80, correct: 5, answered: 5, total: 5, completedNaturally: true });
  const twenty = buildScoreSummary({ mode: 'table-tower', tier: 'starter', ruleVersion: 1, settings: { questionCount: 20 }, rawPoints: 440, correct: 20, answered: 20, total: 20, completedNaturally: true });
  assert.equal(five.normalized, 100);
  assert.equal(twenty.normalized, 100);
  assert.equal(scoreScopeKey(five.scope), '{"mode":"table-tower","tier":"starter","ruleVersion":1,"settings":{"questionCount":5}}');
  assert.notEqual(scoreScopeKey(five.scope), scoreScopeKey(twenty.scope));
});

test('medals use one comparable 0-100 scale', () => {
  assert.equal(medalForNormalizedScore(59), 'starter');
  assert.equal(medalForNormalizedScore(60), 'bronze');
  assert.equal(medalForNormalizedScore(80), 'silver');
  assert.equal(medalForNormalizedScore(95), 'gold');
});

test('legacy scores remain separate and stopped rounds never replace a best', () => {
  let store = normalizeScoreStore({
    version: 2,
    legacy: { scores: { 'table-tower': 500 }, medals: { 'table-tower': 'gold' } },
    bestByScope: {},
  });
  const complete = buildScoreSummary({ mode: 'table-tower', tier: 'starter', ruleVersion: 1, rawPoints: 80, correct: 4, answered: 5, total: 5, completedNaturally: true });
  store = storeComparableScore(store, complete);
  assert.equal(store.legacy.scores['table-tower'], 500);
  assert.equal(store.bestByScope[scoreScopeKey(complete.scope)].normalized, 80);

  const stopped = buildScoreSummary({ mode: 'table-tower', tier: 'starter', ruleVersion: 1, rawPoints: 999, correct: 5, answered: 5, total: 5, completedNaturally: false });
  const unchanged = storeComparableScore(store, stopped);
  assert.deepEqual(unchanged, store);
});

test('malformed score counts clamp to an honest ordering and scope keys cannot collide', () => {
  const summary = buildScoreSummary({ mode: 'error-fix', tier: 'starter', ruleVersion: 1, correct: 9, answered: 2, total: 5, assisted: 7, completedNaturally: true });
  assert.deepEqual({ correct: summary.correct, answered: summary.answered, total: summary.total, assisted: summary.assisted }, { correct: 2, answered: 2, total: 5, assisted: 2 });
  assert.notEqual(
    scoreScopeKey({ mode: 'error-fix', tier: 'starter', ruleVersion: 1, settings: { a: 'x,b=y' } }),
    scoreScopeKey({ mode: 'error-fix', tier: 'starter', ruleVersion: 1, settings: { a: 'x', b: 'y' } }),
  );
  assert.throws(() => buildScoreSummary({ mode: 'bad:mode', tier: 'starter', ruleVersion: 1 }), /requires/i);
  const nonFinite = buildScoreSummary({ mode: 'error-fix', tier: 'starter', ruleVersion: 1, rawPoints: Infinity, total: Infinity, correct: Infinity });
  assert.deepEqual({ rawPoints: nonFinite.rawPoints, total: nonFinite.total, correct: nonFinite.correct, normalized: nonFinite.normalized }, {
    rawPoints: 0, total: 0, correct: 0, normalized: 0,
  });
  assert.equal(isCanonicalScoreStore({
    version: 2,
    legacy: { scores: {}, medals: {} },
    bestByScope: { forged: { ...summary, correct: 99 } },
  }), false);
  const canonical = normalizeScoreStore(storeComparableScore({
    version: 2, legacy: { scores: {}, medals: {} }, bestByScope: {},
  }, buildScoreSummary({
    mode: 'error-fix', tier: 'starter', ruleVersion: 1, correct: 1, answered: 1, total: 1, completedNaturally: true,
  })));
  assert.equal(isCanonicalScoreStore({ ...canonical, futureField: true }), false);
  const [key, storedSummary] = Object.entries(canonical.bestByScope)[0];
  assert.equal(isCanonicalScoreStore({
    ...canonical,
    bestByScope: { [key]: { ...storedSummary, futureField: true } },
  }), false);
});
