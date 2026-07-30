const levelForSkill = (skill) => ({
  complements: 'L2',
  'mixed-operations': 'L3',
  multiplication: 'L4',
  division: 'L4',
  anzan: 'L5',
  mastery: 'L5',
}[skill] || 'L1');

export const installReviewState = async (page, {
  firstCheckSkill = null,
  firstCheckLevel = null,
  activitySkills = [],
  incomplete = false,
} = {}) => {
  const level = firstCheckLevel || levelForSkill(firstCheckSkill);
  const attempt = firstCheckSkill ? {
    version: 1,
    attemptId: `review-${firstCheckSkill}`,
    source: 'exercise',
    itemId: `review-item-${firstCheckSkill}`,
    skill: firstCheckSkill,
    level,
    rule: { id: `review-item-${firstCheckSkill}`, version: 1 },
    eligibility: 'prospective',
    seed: null,
    startedAt: '2026-07-30T00:00:00.000Z',
    events: [{ seq: 1, kind: 'submit', at: '2026-07-30T00:00:01.000Z', value: 'wrong', correct: false }],
  } : null;
  const claims = attempt ? [{
    itemId: attempt.itemId,
    attemptId: attempt.attemptId,
    firstSeenAt: '2026-07-30T00:00:01.000Z',
  }] : [];
  if (incomplete) {
    claims.unshift({
      itemId: 'evicted-review-item',
      attemptId: 'evicted-review-attempt',
      firstSeenAt: '2026-07-29T00:00:00.000Z',
    });
  }
  const exerciseStates = Object.fromEntries(activitySkills.map((skill, index) => [`legacy-${skill}-${index}`, {
    status: 'needs-review',
    skill,
    level: levelForSkill(skill),
    sessionId: `exercise:${levelForSkill(skill)}:${skill}`,
  }]));

  await page.addInitScript((state) => {
    if (localStorage.getItem('soroban-dojo:test-review-seeded') === 'true') return;
    localStorage.setItem('soroban-dojo:test-review-seeded', 'true');
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 1 }));
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify(state.exerciseStates));
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify(state.attempt ? [state.attempt] : []));
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify({ version: 1, claims: state.claims }));
  }, { attempt, claims, exerciseStates });
};
