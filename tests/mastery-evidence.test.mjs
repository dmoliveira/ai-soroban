import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendEvidenceEvent,
  buildMasterySeenIndex,
  claimMasteryItem,
  createAttemptEvidence,
  deriveReviewProfile,
  isCanonicalAttemptEvidence,
  isCanonicalMasterySeenIndex,
  normalizeEvidenceLedger,
  normalizeMasterySeenIndex,
  reviewBucketForSignal,
  selectQualifiedFirstCheckEvidence,
  summarizeAttemptEvidence,
  upsertAttemptEvidence,
} from '../src/lib/mastery.js';

const attempt = () => createAttemptEvidence({
  attemptId: 'attempt-1',
  source: 'exercise',
  itemId: 'exercise-l1-001',
  skill: 'number-setting',
  level: 'L1',
  rule: { id: 'exercise-l1-001', version: 1 },
  startedAt: '2026-07-29T00:00:00.000Z',
});

test('unassisted first-check correctness creates qualified mastery evidence', () => {
  const evidence = appendEvidenceEvent(attempt(), {
    kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z',
  });
  assert.deepEqual(summarizeAttemptEvidence(evidence), {
    valid: true,
    qualified: true,
    firstCheckCorrect: true,
    finalCorrect: true,
    assisted: false,
    checks: 1,
    assistance: [],
  });
});

test('hints and reveals disqualify evidence while an unassisted miss remains an honest sample', () => {
  const assistedScenarios = [
    [
      { kind: 'hint', at: '2026-07-29T00:00:01.000Z' },
      { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:02.000Z' },
    ],
    [
      { kind: 'reveal-final', at: '2026-07-29T00:00:01.000Z' },
      { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:02.000Z' },
    ],
  ];

  assistedScenarios.forEach((events) => {
    const evidence = events.reduce(appendEvidenceEvent, attempt());
    const summary = summarizeAttemptEvidence(evidence);
    assert.equal(summary.qualified, false);
    assert.equal(summary.finalCorrect, true);
  });

  const corrected = [
    { kind: 'submit', value: '3', correct: false, at: '2026-07-29T00:00:01.000Z' },
    { kind: 'recovery', at: '2026-07-29T00:00:02.000Z' },
    { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:03.000Z' },
  ].reduce(appendEvidenceEvent, attempt());
  assert.equal(summarizeAttemptEvidence(corrected).qualified, true);
  assert.equal(summarizeAttemptEvidence(corrected).firstCheckCorrect, false);
});

test('post-check review does not revoke already earned first-check evidence', () => {
  const evidence = [
    { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z' },
    { kind: 'reveal-steps', at: '2026-07-29T00:00:02.000Z' },
  ].reduce(appendEvidenceEvent, attempt());
  const summary = summarizeAttemptEvidence(evidence);
  assert.equal(summary.qualified, true);
  assert.equal(summary.firstCheckCorrect, true);
});

test('ledger upserts attempts by id and stays bounded', () => {
  let ledger = [];
  for (let index = 0; index < 405; index += 1) {
    const evidence = createAttemptEvidence({
      attemptId: `attempt-${index}`,
      source: 'practice',
      itemId: `fact-${index}`,
      skill: 'addition',
      level: 'L1',
      rule: { id: 'generated-addition', version: 1 },
      startedAt: new Date(index * 1000).toISOString(),
    });
    ledger = upsertAttemptEvidence(ledger, evidence, 400);
  }
  assert.equal(ledger.length, 400);
  assert.equal(ledger[0].attemptId, 'attempt-5');

  const updated = appendEvidenceEvent(ledger.at(-1), { kind: 'submit', value: '8', correct: true });
  ledger = upsertAttemptEvidence(ledger, updated, 400);
  assert.equal(ledger.length, 400);
  assert.equal(ledger.at(-1).events.length, 1);
  assert.equal(normalizeEvidenceLedger('wrong').length, 0);
});

test('activity-only and divergent stale histories cannot launder assistance', () => {
  const activityOnly = createAttemptEvidence({
    attemptId: 'legacy-attempt', source: 'practice', itemId: 'fact-1', rule: { id: 'fact', version: 1 }, eligibility: 'activity-only',
  });
  const answered = appendEvidenceEvent(activityOnly, { kind: 'submit', value: '5', correct: true, at: '2026-07-29T00:00:02.000Z' });
  assert.equal(summarizeAttemptEvidence(answered).qualified, false);

  const revealed = appendEvidenceEvent(attempt(), { kind: 'reveal-final', at: '2026-07-29T00:00:01.000Z' });
  const staleCorrect = appendEvidenceEvent(attempt(), { kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:02.000Z' });
  const merged = upsertAttemptEvidence([revealed], staleCorrect)[0];
  assert.deepEqual(merged.events.map((event) => event.kind), ['reveal-final', 'submit']);
  assert.equal(merged.eligibility, 'activity-only');
  assert.equal(summarizeAttemptEvidence(merged).qualified, false);
});

test('a fresh id cannot turn repeated item exposure into another mastery sample', () => {
  const first = appendEvidenceEvent(attempt(), {
    kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z',
  });
  const retry = appendEvidenceEvent(createAttemptEvidence({
    attemptId: 'attempt-2',
    source: 'exercise',
    itemId: 'exercise-l1-001',
    skill: 'number-setting',
    level: 'L1',
    rule: { id: 'exercise-l1-001', version: 1 },
    startedAt: '2026-07-29T00:01:00.000Z',
  }), {
    kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:01:01.000Z',
  });
  const ledger = upsertAttemptEvidence([first], retry);
  assert.equal(ledger[0].eligibility, 'prospective');
  assert.equal(ledger[1].eligibility, 'activity-only');
  assert.equal(summarizeAttemptEvidence(ledger[1]).qualified, false);
});

test('the monotonic seen-item index survives bounded evidence eviction', () => {
  const first = appendEvidenceEvent(attempt(), {
    kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z',
  });
  const seen = buildMasterySeenIndex([first]);
  const ledger = [first];
  for (let index = 0; index < 400; index += 1) {
    ledger.push(appendEvidenceEvent(createAttemptEvidence({
      attemptId: `new-${index}`,
      source: 'practice',
      itemId: `generated-${index}`,
      rule: { id: 'generated', version: 1 },
      startedAt: `2026-07-29T00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`,
    }), { kind: 'submit', value: String(index), correct: true, at: '2026-07-29T01:00:00.000Z' }));
  }
  assert.equal(normalizeEvidenceLedger(ledger).some((entry) => entry.itemId === 'exercise-l1-001'), false);
  assert.equal(seen.claims.some((claim) => claim.itemId === 'exercise-l1-001'), true);
  const retryClaim = claimMasteryItem(seen, {
    itemId: 'exercise-l1-001', attemptId: 'retry-after-eviction', firstSeenAt: '2026-07-30T00:00:00.000Z',
  });
  assert.equal(retryClaim.eligible, false);
  assert.equal(retryClaim.changed, false);
});

test('malformed trust facts normalize only as activity', () => {
  const malformed = {
    ...attempt(),
    rule: undefined,
    events: [{ seq: 1, kind: 'submit', value: '4', correct: true }],
  };
  assert.equal(isCanonicalAttemptEvidence(malformed), false);
  assert.equal(summarizeAttemptEvidence(malformed).qualified, false);

  const canonical = appendEvidenceEvent(attempt(), {
    kind: 'submit', value: '4', correct: true, at: '2026-07-29T00:00:01.000Z',
  });
  assert.equal(isCanonicalAttemptEvidence({ ...canonical, futureField: true }), false);
  assert.equal(isCanonicalAttemptEvidence({
    ...canonical,
    events: [{ ...canonical.events[0], assisted: true }],
  }), false);
  assert.equal(isCanonicalMasterySeenIndex({
    version: 1,
    claims: [{ itemId: 'item', attemptId: 'attempt', firstSeenAt: '2026-07-29T00:00:00.000Z', futureField: true }],
  }), false);
});

const reviewAttempt = ({
  attemptId,
  itemId,
  skill = 'division',
  correct,
  startedAt = '2026-01-01T00:00:00.000Z',
  assisted = false,
}) => {
  let evidence = createAttemptEvidence({
    attemptId,
    source: 'exercise',
    itemId,
    skill,
    level: skill === 'division' || skill === 'multiplication' ? 'L4' : 'L2',
    rule: { id: `exercise.${skill}`, version: 1 },
    startedAt,
  });
  if (assisted) evidence = appendEvidenceEvent(evidence, { kind: 'hint', at: startedAt });
  return appendEvidenceEvent(evidence, { kind: 'submit', value: correct ? '4' : '5', correct, at: startedAt });
};

const seenFor = (...attempts) => attempts.reduce((index, evidence, position) => claimMasteryItem(index, {
  itemId: evidence.itemId,
  attemptId: evidence.attemptId,
  firstSeenAt: `2026-01-01T00:00:${String(position).padStart(2, '0')}.000Z`,
}).index, normalizeMasterySeenIndex(null));

test('review profile keeps a corrected first-check miss unresolved', () => {
  let miss = reviewAttempt({ attemptId: 'attempt-miss', itemId: 'division-a', correct: false });
  miss = appendEvidenceEvent(miss, { kind: 'submit', value: '4', correct: true, at: '2026-01-01T00:01:00.000Z' });
  const profile = deriveReviewProfile({ evidenceLedger: [miss], seenIndex: seenFor(miss), activityStates: {} });
  assert.equal(profile.basis, 'first-check');
  assert.equal(profile.focus.key, 'division');
  assert.deepEqual(profile.buckets.division.unresolvedItemIds, ['division-a']);
});

test('qualified first checks follow canonical claim order rather than ledger order', () => {
  const first = reviewAttempt({ attemptId: 'owned-first', itemId: 'division-a', correct: false });
  const second = reviewAttempt({ attemptId: 'owned-second', itemId: 'multiply-a', skill: 'multiplication', correct: true });
  const orphan = reviewAttempt({ attemptId: 'orphan-first', itemId: 'division-a', correct: true });
  const seenIndex = {
    version: 1,
    claims: [
      { itemId: first.itemId, attemptId: first.attemptId, firstSeenAt: '2026-07-30T00:00:00.000Z' },
      { itemId: second.itemId, attemptId: second.attemptId, firstSeenAt: '2026-07-30T00:00:01.000Z' },
    ],
  };

  const selected = selectQualifiedFirstCheckEvidence({ evidenceLedger: [orphan, second, first], seenIndex });

  assert.deepEqual(selected.map(({ attempt, claimIndex }) => [attempt.attemptId, claimIndex]), [
    ['owned-first', 0],
    ['owned-second', 1],
  ]);
  assert.equal(selected[0].summary.firstCheckCorrect, false);
  assert.equal(selected[1].summary.firstCheckCorrect, true);
});

test('qualified first-check selection fails closed for invalid ownership and duplicate attempts', () => {
  const attempt = reviewAttempt({ attemptId: 'duplicate', itemId: 'division-a', correct: false });
  const duplicate = reviewAttempt({ attemptId: 'duplicate', itemId: 'division-b', correct: true });
  const canonicalSeen = {
    version: 1,
    claims: [{ itemId: attempt.itemId, attemptId: attempt.attemptId, firstSeenAt: '2026-07-30T00:00:00.000Z' }],
  };
  const duplicateItems = {
    version: 1,
    claims: [
      canonicalSeen.claims[0],
      { itemId: attempt.itemId, attemptId: 'other', firstSeenAt: '2026-07-30T00:00:01.000Z' },
    ],
  };

  assert.deepEqual(selectQualifiedFirstCheckEvidence({ evidenceLedger: [attempt], seenIndex: null }), []);
  assert.deepEqual(selectQualifiedFirstCheckEvidence({ evidenceLedger: [attempt], seenIndex: { ...canonicalSeen, version: 99 } }), []);
  assert.deepEqual(selectQualifiedFirstCheckEvidence({ evidenceLedger: [attempt], seenIndex: duplicateItems }), []);
  assert.deepEqual(selectQualifiedFirstCheckEvidence({ evidenceLedger: [attempt, duplicate], seenIndex: canonicalSeen }), []);
  assert.deepEqual(selectQualifiedFirstCheckEvidence({
    evidenceLedger: [attempt],
    seenIndex: { version: 1, claims: [{ ...canonicalSeen.claims[0], itemId: 'different-item' }] },
  }), []);
});

test('a later distinct same-skill first check resolves one prior miss FIFO', () => {
  const missA = reviewAttempt({ attemptId: 'miss-a', itemId: 'division-a', correct: false, startedAt: '2030-01-01T00:00:00.000Z' });
  const missB = reviewAttempt({ attemptId: 'miss-b', itemId: 'division-b', correct: false, startedAt: '2020-01-01T00:00:00.000Z' });
  const recovery = reviewAttempt({ attemptId: 'correct-c', itemId: 'division-c', correct: true, startedAt: '2010-01-01T00:00:00.000Z' });
  const profile = deriveReviewProfile({
    evidenceLedger: [recovery, missB, missA],
    seenIndex: seenFor(missA, missB, recovery),
    activityStates: {},
  });
  assert.equal(profile.historyIncomplete, false);
  assert.deepEqual(profile.buckets.division.unresolvedItemIds, ['division-b']);
});

test('different-skill, assisted, and unowned correct attempts cannot resolve a miss', () => {
  const miss = reviewAttempt({ attemptId: 'miss-a', itemId: 'division-a', correct: false });
  const otherSkill = reviewAttempt({ attemptId: 'correct-mul', itemId: 'multiply-a', skill: 'multiplication', correct: true });
  const assisted = reviewAttempt({ attemptId: 'correct-assisted', itemId: 'division-b', correct: true, assisted: true });
  const unowned = reviewAttempt({ attemptId: 'correct-unowned', itemId: 'division-c', correct: true });
  const profile = deriveReviewProfile({
    evidenceLedger: [miss, otherSkill, assisted, unowned],
    seenIndex: seenFor(miss, otherSkill, assisted),
    activityStates: {},
  });
  assert.deepEqual(profile.buckets.division.unresolvedItemIds, ['division-a']);
  assert.equal(profile.retainedQualifiedCount, 2);
});

test('missing owned detail disables recovery while retaining known misses', () => {
  const missing = reviewAttempt({ attemptId: 'evicted', itemId: 'division-old', correct: false });
  const miss = reviewAttempt({ attemptId: 'miss-a', itemId: 'division-a', correct: false });
  const recovery = reviewAttempt({ attemptId: 'correct-b', itemId: 'division-b', correct: true });
  const profile = deriveReviewProfile({
    evidenceLedger: [miss, recovery],
    seenIndex: seenFor(missing, miss, recovery),
    activityStates: {},
  });
  assert.equal(profile.historyIncomplete, true);
  assert.equal(profile.missingClaimDetails, 1);
  assert.deepEqual(profile.buckets.division.unresolvedItemIds, ['division-a']);
});

test('unowned prospective detail is ignored without becoming review evidence', () => {
  const miss = reviewAttempt({ attemptId: 'unowned-miss', itemId: 'division-a', correct: false });
  const profile = deriveReviewProfile({
    evidenceLedger: [miss],
    seenIndex: normalizeMasterySeenIndex(null),
    activityStates: {},
  });
  assert.equal(profile.historyIncomplete, false);
  assert.equal(profile.unownedProspectiveDetails, 1);
  assert.equal(profile.basis, 'none');
});

test('unowned prospective detail cannot block valid owned recovery', () => {
  const miss = reviewAttempt({ attemptId: 'owned-miss', itemId: 'division-a', correct: false });
  const recovery = reviewAttempt({ attemptId: 'owned-correct', itemId: 'division-b', correct: true });
  const orphan = reviewAttempt({ attemptId: 'orphan', itemId: 'division-c', correct: false });
  const profile = deriveReviewProfile({
    evidenceLedger: [miss, recovery, orphan],
    seenIndex: seenFor(miss, recovery),
    activityStates: {},
  });
  assert.equal(profile.historyIncomplete, false);
  assert.equal(profile.unownedProspectiveDetails, 1);
  assert.equal(profile.evidenceTotal, 0);
});

test('duplicate attempt ownership is incomplete and cannot double count', () => {
  const first = reviewAttempt({ attemptId: 'duplicate-attempt', itemId: 'division-a', correct: false });
  const second = reviewAttempt({ attemptId: 'duplicate-attempt', itemId: 'division-b', correct: false });
  const profile = deriveReviewProfile({
    evidenceLedger: [first, second],
    seenIndex: seenFor(first, second),
    activityStates: {},
  });
  assert.equal(profile.historyIncomplete, true);
  assert.equal(profile.missingClaimDetails, 2);
  assert.equal(profile.evidenceTotal, 0);
});

test('each later correct resolves at most one retained miss', () => {
  const missA = reviewAttempt({ attemptId: 'miss-a', itemId: 'division-a', correct: false });
  const missB = reviewAttempt({ attemptId: 'miss-b', itemId: 'division-b', correct: false });
  const correct = reviewAttempt({ attemptId: 'correct-a', itemId: 'division-c', correct: true });
  const profile = deriveReviewProfile({
    evidenceLedger: [missA, missB, correct],
    seenIndex: seenFor(missA, missB, correct),
    activityStates: {},
  });
  assert.equal(profile.evidenceTotal, 1);
  assert.deepEqual(profile.buckets.division.unresolvedItemIds, ['division-b']);
});

test('legacy review is a per-item fallback only without qualified owned detail', () => {
  const correct = reviewAttempt({ attemptId: 'correct-a', itemId: 'exercise-a', skill: 'complements', correct: true });
  const profile = deriveReviewProfile({
    evidenceLedger: [correct],
    seenIndex: seenFor(correct),
    activityStates: {
      'exercise-a': { status: 'needs-review', skill: 'complements', level: 'L2' },
      'exercise-b': { status: 'needs-review', skill: 'multiplication', level: 'L4' },
    },
  });
  assert.equal(profile.basis, 'activity');
  assert.equal(profile.focus.key, 'multiplication');
  assert.deepEqual(profile.buckets.complements.legacyItemIds, []);
  assert.deepEqual(profile.buckets.multiplication.legacyItemIds, ['exercise-b']);
});

test('review buckets preserve deterministic level and session fallbacks', () => {
  assert.equal(reviewBucketForSignal({ skill: 'anzan' }), 'mental');
  assert.equal(reviewBucketForSignal({ skill: 'division', level: 'L4' }), 'division');
  assert.equal(reviewBucketForSignal({ level: 'L4' }), 'multiplication');
  assert.equal(reviewBucketForSignal({ sessionId: 'practice:L2:legacy' }), 'complements');
  assert.equal(reviewBucketForSignal({ skill: 'addition' }), 'arithmetic');
});

test('review focus uses the documented stable tie order', () => {
  const profile = deriveReviewProfile({
    evidenceLedger: [],
    seenIndex: normalizeMasterySeenIndex(null),
    activityStates: {
      mental: { status: 'needs-review', skill: 'anzan', level: 'L5' },
      division: { status: 'needs-review', skill: 'division', level: 'L4' },
      multiplication: { status: 'needs-review', skill: 'multiplication', level: 'L4' },
    },
  });
  assert.equal(profile.focus.key, 'mental');
});
