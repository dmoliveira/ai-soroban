import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContinuityRecommendation,
  buildFocusedPracticeHref,
  buildFocusedWorksheetHref,
  deriveContinuityKey,
  readContinuitySnapshot,
  resolveWorksheetTarget,
  toBaseHref,
} from '../src/lib/learner-continuity.js';
import { STORAGE_KEYS } from '../src/lib/storage.js';

const placement = { level: 'L4', title: 'Advanced', reason: 'Start multiplication and division patterns.' };
const baseSnapshot = {
  context: { path: 'adults', startingPoint: placement },
  completedLessons: [],
  exerciseStates: {},
  practiceSessions: [],
  weeklyPlan: {},
  continuityKey: 'placement:L4',
};

test('continuity priority is resume, review, fresh weekly step, placement, route, recent, setup', () => {
  const resume = buildContinuityRecommendation({
    ...baseSnapshot,
    practiceSessions: [{ id: 'dojo-safe-1', level: 'L3', completed: false, currentIndex: 0, questions: [{ id: 'q-1', title: 'One plus one', prompt: '1 + 1', answer: 2, steps: ['Add one.'] }] }],
    exerciseStates: { weak: { status: 'needs-review', skill: 'division', level: 'L4' } },
  });
  assert.equal(resume.kind, 'resume');
  assert.equal(resume.primary.href, 'practice?resume=dojo-safe-1');

  const review = buildContinuityRecommendation({
    ...baseSnapshot,
    exerciseStates: { weak: { status: 'needs-review', skill: 'division', level: 'L4' } },
    weeklyPlan: { continuityKey: 'review:division', planId: 'division', lesson: { id: 'lesson', done: false }, exercise: { id: 'exercise', done: false }, worksheet: { href: '/worksheet', done: false } },
    continuityKey: 'review:division',
  });
  assert.equal(review.kind, 'review');
  assert.match(review.primary.href, /level=L4/);
  assert.match(review.primary.href, /skill=division/);

  const weekly = buildContinuityRecommendation({
    ...baseSnapshot,
    weeklyPlan: { continuityKey: 'placement:L4', planId: 'multiplication', lesson: { id: 'lesson', done: true }, exercise: { id: 'exercise', done: false }, worksheet: { href: '/worksheet', done: false } },
  });
  assert.equal(weekly.kind, 'weekly-plan');
  assert.match(weekly.title, /exercise/);
  assert.equal(buildContinuityRecommendation(baseSnapshot).kind, 'placement');
  assert.equal(buildContinuityRecommendation({ ...baseSnapshot, context: { path: 'children', startingPoint: null } }).kind, 'route');
  assert.equal(buildContinuityRecommendation({
    ...baseSnapshot,
    context: { path: 'adults', startingPoint: null },
    completedLessons: ['lesson-l0-001'],
    practiceSessions: [{ id: 'done', level: 'L2', skill: 'complements', completed: true }],
  }).kind, 'route-progress');
  assert.equal(buildContinuityRecommendation({ ...baseSnapshot, context: { path: null, startingPoint: null }, completedLessons: ['lesson-l0-001'], practiceSessions: [{ id: 'done', level: 'L2', skill: 'complements', completed: true }] }).kind, 'recent-practice');
  assert.equal(buildContinuityRecommendation({ ...baseSnapshot, context: { path: null, startingPoint: null } }).kind, 'setup');
});

test('stale, legacy, unsafe, and unsupported sessions are not promoted', () => {
  const result = buildContinuityRecommendation({
    ...baseSnapshot,
    practiceSessions: [
      { id: 'unsafe/id', level: 'L4', completed: false, questions: [{}] },
      { id: 'dojo-challenge', level: 'L4', completed: false, questions: [{}], challengeKey: 'ten-bridge' },
      { id: 'dojo-empty', level: 'L4', completed: false, currentIndex: 0, questions: [] },
    ],
    weeklyPlan: { continuityKey: 'placement:L4' },
  });
  assert.equal(result.kind, 'placement');
});

test('supported challenge sessions remain safely resumable', () => {
  const result = buildContinuityRecommendation({
    ...baseSnapshot,
    practiceSessions: [{
      id: 'dojo-challenge-safe',
      level: 'L0',
      completed: false,
      currentIndex: 0,
      questions: [],
      responses: {},
      challengeKey: 'bead-match',
      challengeSeed: 'challenge-seed',
      challengeRuleVersion: 1,
    }],
  });
  assert.equal(result.kind, 'resume');
  assert.equal(result.primary.href, 'practice?resume=dojo-challenge-safe');
});

test('target links and worksheet resolution are allowlisted and base-path safe', () => {
  assert.equal(buildFocusedPracticeHref('L4', 'division'), 'practice?level=L4&skill=division&start=1');
  assert.equal(buildFocusedPracticeHref('L0', 'number-setting'), 'practice?level=L1&skill=number-setting&start=1');
  assert.equal(buildFocusedPracticeHref('L9', 'unknown'), 'practice');
  assert.equal(buildFocusedWorksheetHref('division'), 'worksheets?preset=division-focus&submode=quotient-building');
  assert.deepEqual(resolveWorksheetTarget({ submode: 'anzan-recall' }), { preset: 'anzan-focus', submode: 'anzan-recall' });
  assert.deepEqual(resolveWorksheetTarget({ preset: 'foundations-focus', submode: 'arithmetic-rhythm' }), { preset: 'foundations-focus', submode: 'arithmetic-rhythm' });
  assert.deepEqual(resolveWorksheetTarget({ preset: 'foundations-focus', submode: 'quotient-building' }), { preset: 'division-focus', submode: 'quotient-building' });
  assert.deepEqual(resolveWorksheetTarget({ preset: 'speed', submode: 'unknown' }), { preset: 'speed', submode: null });
  assert.deepEqual(resolveWorksheetTarget({ preset: 'unknown', submode: 'unknown' }), { preset: 'foundations-focus', submode: null });
  assert.equal(toBaseHref('/soroban-dojo', 'practice?level=L4'), '/soroban-dojo/practice?level=L4');
  assert.equal(toBaseHref('/soroban-dojo/', 'https://example.com'), '/soroban-dojo/');
});

test('snapshot reads local context without mutating bytes and derives freshness', () => {
  const values = new Map([
    [STORAGE_KEYS.path, 'adults'],
    [STORAGE_KEYS.placementResult, JSON.stringify({ choice: placement, answers: {} })],
    [STORAGE_KEYS.exerciseStates, JSON.stringify({ weak: { status: 'needs-review', skill: 'multiplication', level: 'L4' } })],
    [STORAGE_KEYS.practiceSessions, '{}'],
    [STORAGE_KEYS.weeklyStudyPlan, JSON.stringify({ continuityKey: 'review:multiplication', lesson: { done: false } })],
  ]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  const before = Object.fromEntries(values);
  const snapshot = readContinuitySnapshot(storage);
  assert.equal(snapshot.continuityKey, 'review:multiplication');
  assert.deepEqual(snapshot.practiceSessions, []);
  assert.deepEqual(Object.fromEntries(values), before);
  assert.equal(deriveContinuityKey({ context: { path: 'children', startingPoint: null }, exerciseStates: {} }), 'path:children');
});
