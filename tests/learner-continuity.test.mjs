import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildContinuityRecommendation,
  buildFocusedPracticeHref,
  buildFocusedWorksheetHref,
  deriveContinuityKey,
  formatReviewBasis,
  readContinuitySnapshot,
  resolveFreshWeeklyPlan,
  resolveReviewFocus,
  resolveReviewTargetForLevel,
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

const firstCheckAttempt = ({
  attemptId = 'attempt-division',
  itemId = 'division-a',
  skill = 'division',
  level = 'L4',
  correct = false,
} = {}) => ({
  version: 1,
  attemptId,
  source: 'exercise',
  itemId,
  skill,
  level,
  rule: { id: itemId, version: 1 },
  eligibility: 'prospective',
  seed: null,
  startedAt: '2026-07-30T00:00:00.000Z',
  events: [{ seq: 1, kind: 'submit', at: '2026-07-30T00:00:01.000Z', value: '4', correct }],
});

const seenIndexFor = (...attempts) => ({
  version: 1,
  claims: attempts.map((attempt, index) => ({
    itemId: attempt.itemId,
    attemptId: attempt.attemptId,
    firstSeenAt: `2026-07-30T00:00:0${index + 1}.000Z`,
  })),
});

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
    weeklyPlan: { continuityKey: 'review:activity:complete:division', planId: 'division', lesson: { id: 'lesson', done: false }, exercise: { id: 'exercise', done: false }, worksheet: { href: '/worksheet', done: false } },
    continuityKey: 'review:activity:complete:division',
  });
  assert.equal(review.kind, 'review');
  assert.match(review.copy, /does not include an unassisted first answer/);
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
    [STORAGE_KEYS.weeklyStudyPlan, JSON.stringify({ continuityKey: 'review:activity:complete:multiplication', lesson: { done: false } })],
  ]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  const before = Object.fromEntries(values);
  const snapshot = readContinuitySnapshot(storage);
  assert.equal(snapshot.continuityKey, 'review:activity:complete:multiplication');
  assert.equal(snapshot.reviewProfile.basis, 'activity');
  assert.deepEqual(snapshot.practiceSessions, []);
  assert.deepEqual(Object.fromEntries(values), before);
  assert.equal(deriveContinuityKey({ context: { path: 'children', startingPoint: null }, exerciseStates: {} }), 'path:children');
  assert.equal(deriveContinuityKey({ context: { path: null, startingPoint: null }, completedLessons: [], exerciseStates: {} }), 'default:new');
  assert.equal(deriveContinuityKey({ context: { path: null, startingPoint: null }, completedLessons: [], exerciseStates: { complete: { status: 'got-it' } } }), 'default:progress');
});

test('first-check review evidence outranks conflicting saved activity without write-on-read', () => {
  const miss = firstCheckAttempt();
  const values = new Map([
    [STORAGE_KEYS.exerciseStates, JSON.stringify({
      legacyA: { status: 'needs-review', skill: 'multiplication', level: 'L4' },
      legacyB: { status: 'needs-review', skill: 'multiplication', level: 'L4' },
    })],
    [STORAGE_KEYS.masteryEvidence, JSON.stringify([miss])],
    [STORAGE_KEYS.masterySeenItems, JSON.stringify(seenIndexFor(miss))],
  ]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: () => assert.fail('review profile reads must not write'),
  };
  const before = Object.fromEntries(values);

  const snapshot = readContinuitySnapshot(storage);
  const focus = resolveReviewFocus(snapshot.reviewProfile);

  assert.equal(snapshot.continuityKey, 'review:first-check:complete:division');
  assert.equal(snapshot.reviewProfile.basis, 'first-check');
  assert.equal(focus?.key, 'division');
  assert.match(formatReviewBasis(snapshot.reviewProfile), /1 answer from your first unassisted check/);
  assert.deepEqual(Object.fromEntries(values), before);
});

test('incomplete retained detail changes freshness and prevents confident recovery copy', () => {
  const miss = firstCheckAttempt();
  const values = new Map([
    [STORAGE_KEYS.masteryEvidence, JSON.stringify([miss])],
    [STORAGE_KEYS.masterySeenItems, JSON.stringify({
      version: 1,
      claims: [
        { itemId: 'evicted-division', attemptId: 'missing-attempt', firstSeenAt: '2026-07-29T00:00:00.000Z' },
        ...seenIndexFor(miss).claims,
      ],
    })],
  ]);
  const snapshot = readContinuitySnapshot({ getItem: (key) => values.get(key) ?? null });

  assert.equal(snapshot.continuityKey, 'review:first-check:incomplete:division');
  assert.equal(snapshot.reviewProfile.historyIncomplete, true);
  assert.equal(snapshot.reviewProfile.missingClaimDetails, 1);
  assert.match(formatReviewBasis(snapshot.reviewProfile), /Some older first-check details are missing/);
  assert.match(formatReviewBasis(snapshot.reviewProfile), /known misses stay in review/);
});

test('invalid ownership fails first-check trust closed while labeling legacy activity fallback', () => {
  const miss = firstCheckAttempt();
  const values = new Map([
    [STORAGE_KEYS.exerciseStates, JSON.stringify({ legacy: { status: 'needs-review', skill: 'complements', level: 'L2' } })],
    [STORAGE_KEYS.masteryEvidence, JSON.stringify([miss])],
    [STORAGE_KEYS.masterySeenItems, JSON.stringify({ ...seenIndexFor(miss), version: 99 })],
  ]);
  const snapshot = readContinuitySnapshot({ getItem: (key) => values.get(key) ?? null });

  assert.equal(snapshot.reviewProfile.basis, 'activity');
  assert.equal(snapshot.reviewProfile.historyIncomplete, true);
  assert.equal(snapshot.reviewProfile.retainedQualifiedCount, 0);
  assert.equal(snapshot.continuityKey, 'review:activity:incomplete:complements');
  assert.match(formatReviewBasis(snapshot.reviewProfile), /saved review item/);
  assert.match(formatReviewBasis(snapshot.reviewProfile), /Some older first-check details are missing/);
});

test('review helpers preserve level constraints, empty copy, and weekly-plan freshness', () => {
  const activityProfile = readContinuitySnapshot({
    getItem: (key) => key === STORAGE_KEYS.exerciseStates
      ? JSON.stringify({ division: { status: 'needs-review', skill: 'division', level: 'L4' } })
      : null,
  }).reviewProfile;
  assert.equal(resolveReviewTargetForLevel(activityProfile, 'L2')?.target.skill, 'complements');
  assert.equal(resolveReviewTargetForLevel(activityProfile, 'L4')?.target.skill, 'division');
  assert.match(formatReviewBasis(activityProfile), /saved review item/);
  assert.match(formatReviewBasis(activityProfile), /does not include an unassisted first answer/);
  assert.equal(formatReviewBasis(readContinuitySnapshot({ getItem: () => null }).reviewProfile), 'No first-check answers or saved review items currently point to a review focus.');

  const freshPlan = {
    continuityKey: 'review:activity:complete:division',
    planId: 'division',
    lesson: { id: 'lesson', done: true },
    exercise: { id: 'exercise', done: false },
    worksheet: { href: 'worksheets', done: false },
  };
  assert.equal(resolveFreshWeeklyPlan({ weeklyPlan: freshPlan, continuityKey: freshPlan.continuityKey, reviewProfile: activityProfile }).step, 'exercise');
  assert.deepEqual(resolveFreshWeeklyPlan({ weeklyPlan: freshPlan, continuityKey: 'review:first-check:complete:division', reviewProfile: activityProfile }), { plan: null, step: null });
  assert.deepEqual(resolveFreshWeeklyPlan({ weeklyPlan: { ...freshPlan, planId: 'multiplication' }, continuityKey: freshPlan.continuityKey, reviewProfile: activityProfile }), { plan: null, step: null });
  assert.deepEqual(resolveFreshWeeklyPlan({ weeklyPlan: {}, continuityKey: 'default:new' }), { plan: null, step: null });
  assert.deepEqual(resolveFreshWeeklyPlan({
    weeklyPlan: { ...freshPlan, continuityKey: 'default:new', planId: 'foundations' },
    context: { path: null, startingPoint: null },
    completedLessons: [],
    exerciseStates: { complete: { status: 'got-it' } },
  }), { plan: null, step: null });
});
