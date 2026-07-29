import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendEvidenceEvent,
  buildMasterySeenIndex,
  claimMasteryItem,
  createAttemptEvidence,
  isCanonicalAttemptEvidence,
  isCanonicalMasterySeenIndex,
  normalizeEvidenceLedger,
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
