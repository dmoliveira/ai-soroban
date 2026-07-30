import { expect, test } from '@playwright/test';

const solvePracticePrompt = (prompt) => {
  const addMatch = prompt.match(/Start from (\d+)\. Add (\d+)\./);
  if (addMatch) return Number(addMatch[1]) + Number(addMatch[2]);
  const subtractMatch = prompt.match(/Start from (\d+)\. Subtract (\d+)\./);
  if (subtractMatch) return Number(subtractMatch[1]) - Number(subtractMatch[2]);
  throw new Error(`Unsupported practice prompt: ${prompt}`);
};

const startSinglePractice = async (page) => {
  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-format', 'single');
  await page.selectOption('#session-type', 'generated');
  await page.selectOption('#session-level', 'L1');
  await page.selectOption('#session-length', '5');
  await page.selectOption('#check-mode', 'final');
  await page.getByRole('button', { name: 'Start new session' }).click();
};

const currentAnswer = async (page) => solvePracticePrompt((await page.locator('#question-prompt').textContent()) || '');

test('ordinary Practice distinguishes first checks, corrections, assistance, and repeats', async ({ page }) => {
  await startSinglePractice(page);

  const firstAnswer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(firstAnswer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('Correct on first check');
  await expect(page.locator('#feedback-panel')).toContainText('unassisted first-check evidence');
  await expect(page.locator('#feedback-panel')).toContainText(`Answer: ${firstAnswer}.`);

  await page.locator('#next-question').click();
  const secondAnswer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(secondAnswer + 1));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('First check missed');
  await page.locator('#answer-input').fill(String(secondAnswer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('Correct now, but the first check was missed');
  await expect(page.locator('#feedback-panel')).toContainText('does not replace the first result');

  await page.locator('#next-question').click();
  const thirdAnswer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(thirdAnswer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#reveal-final').click();
  await page.locator('#answer-input').fill(String(thirdAnswer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('Correct now after assistance');
  await expect(page.locator('#feedback-panel')).toContainText('original first check remains a miss');

  await page.locator('#next-question').click();
  const fourthAnswer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(fourthAnswer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#use-recovery-prompt').click();
  await page.locator('#answer-input').fill(String(fourthAnswer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('Correct now after assistance');

  await page.locator('#next-question').click();
  await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]');
    const session = sessions[0];
    const question = session.questions[session.currentIndex];
    const itemId = question.progressKey || question.id;
    const seen = JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || '{"version":1,"claims":[]}');
    seen.claims = seen.claims.filter((claim) => claim.itemId !== itemId);
    seen.claims.push({ itemId, attemptId: 'prior-practice-attempt', firstSeenAt: '2026-07-30T00:00:00.000Z' });
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify(seen));
  });
  await page.locator('#answer-input').fill(String(await currentAnswer(page)));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('repeated item remains activity');
});

test('Practice reports an evidence-only write failure without overstating session loss', async ({ page }) => {
  await startSinglePractice(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:mastery-evidence-v1') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });

  await page.locator('#answer-input').fill(String(await currentAnswer(page)));
  await page.locator('#verify-answer').click();

  await expect(page.locator('#feedback-panel')).toContainText('Correct on first check in this tab');
  await expect(page.locator('#feedback-panel')).toContainText('some progress data could not be saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'))).toEqual([]);
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]'));
  expect(sessions[0].responses[0].correct).toBe(true);
});

test('Practice reports a session-only write failure while retaining evidence', async ({ page }) => {
  await startSinglePractice(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:practice-sessions') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });

  await page.locator('#answer-input').fill(String(await currentAnswer(page)));
  await page.locator('#verify-answer').click();

  await expect(page.locator('#feedback-panel')).toContainText('Correct on first check');
  await expect(page.locator('#feedback-panel')).toContainText('some progress data could not be saved');
  const evidence = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({ source: 'practice', eligibility: 'prospective' });
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]'));
  expect(sessions[0].responses[0]?.correct).not.toBe(true);
});

test('Practice saves a skipped typed response without inventing verification or review activity', async ({ page }) => {
  await startSinglePractice(page);
  await page.locator('#answer-input').fill('999');
  await page.locator('#next-question').click();

  const stored = await page.evaluate(() => ({
    session: JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0],
    activity: JSON.parse(localStorage.getItem('soroban-dojo:exercise-states') || '{}'),
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
  }));
  expect(stored.session.currentIndex).toBe(1);
  expect(stored.session.responses[0]).toMatchObject({ input: '999', verified: false, correct: false });
  expect(stored.activity[stored.session.questions[0].progressKey]).toBeUndefined();
  expect(stored.evidence).toEqual([]);
});

test('Practice invalidates a changed answer until it is checked again', async ({ page }) => {
  await startSinglePractice(page);
  const answer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(answer + 1));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('First check missed');
  await page.locator('#answer-input').fill(String(answer));
  await page.locator('#next-question').click();

  const stored = await page.evaluate(() => ({
    session: JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0],
    activity: JSON.parse(localStorage.getItem('soroban-dojo:exercise-states') || '{}'),
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
  }));
  expect(stored.session.responses[0]).toMatchObject({ input: String(answer), verified: false, correct: false });
  expect(stored.activity[stored.session.questions[0].progressKey]).toBeUndefined();
  expect(stored.evidence).toHaveLength(1);
  expect(stored.evidence[0].events[0]).toMatchObject({ kind: 'submit', correct: false });
});

test('Practice keeps an unchanged checked miss eligible for saved review activity', async ({ page }) => {
  await startSinglePractice(page);
  const answer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(answer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#next-question').click();

  const stored = await page.evaluate(() => ({
    session: JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0],
    activity: JSON.parse(localStorage.getItem('soroban-dojo:exercise-states') || '{}'),
  }));
  expect(stored.session.responses[0]).toMatchObject({ verified: true, correct: false });
  expect(stored.activity[stored.session.questions[0].progressKey]).toMatchObject({ status: 'needs-review' });
});

test('Practice applies the same truthful transition on the final question', async ({ page }) => {
  const startAtFinalQuestion = async () => {
    await page.goto('practice');
    await page.evaluate(() => localStorage.clear());
    await startSinglePractice(page);
    for (let index = 0; index < 4; index += 1) await page.locator('#next-question').click();
  };
  const storedOutcome = () => page.evaluate(() => ({
    session: JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0],
    activity: JSON.parse(localStorage.getItem('soroban-dojo:exercise-states') || '{}'),
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
  }));

  await startAtFinalQuestion();
  await page.locator('#answer-input').fill('999');
  await page.locator('#next-question').click();
  let stored = await storedOutcome();
  expect(stored.session).toMatchObject({ completed: true, finalScore: 0 });
  expect(stored.session.responses[4]).toMatchObject({ input: '999', verified: false, correct: false });
  expect(stored.activity[stored.session.questions[4].progressKey]).toBeUndefined();
  expect(stored.evidence).toEqual([]);

  await startAtFinalQuestion();
  let answer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(answer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#answer-input').fill(String(answer));
  await page.locator('#next-question').click();
  stored = await storedOutcome();
  expect(stored.session.responses[4]).toMatchObject({ input: String(answer), verified: false, correct: false });
  expect(stored.activity[stored.session.questions[4].progressKey]).toBeUndefined();
  expect(stored.evidence).toHaveLength(1);
  expect(stored.evidence[0].events[0]).toMatchObject({ kind: 'submit', correct: false });

  await startAtFinalQuestion();
  answer = await currentAnswer(page);
  await page.locator('#answer-input').fill(String(answer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#next-question').click();
  stored = await storedOutcome();
  expect(stored.session.responses[4]).toMatchObject({ verified: true, correct: false });
  expect(stored.activity[stored.session.questions[4].progressKey]).toMatchObject({ status: 'needs-review' });
  expect(stored.evidence).toHaveLength(1);
});

test('ordinary Practice sheets keep reveal-before-check results assisted', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-type', 'generated');
  await page.selectOption('#session-level', 'L1');
  await page.selectOption('#session-format', 'sheet');
  await page.selectOption('#session-length', '5');
  await page.getByRole('button', { name: 'Start new session' }).click();

  await page.locator('#reveal-sheet-answers').click();
  const firstInput = page.locator('#sheet-list .input').first();
  const firstAnswer = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0].questions[0].answer);
  await firstInput.fill(String(firstAnswer));
  await page.locator('#check-sheet').click();

  await expect(page.locator('#sheet-feedback-panel')).toContainText('Qualified first-check samples: 0/5');
  const evidence = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  expect(evidence).toHaveLength(5);
  expect(evidence.every((attempt) => attempt.events[0]?.kind === 'reveal-final')).toBe(true);
  expect(evidence.every((attempt) => attempt.events.some((event) => event.kind === 'submit'))).toBe(true);
});

test('curated L3 and L4 sessions never fall back to another level', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-type', 'curated');

  for (const level of ['L3', 'L4']) {
    await page.selectOption('#session-level', level);
    await page.selectOption('#session-length', '5');
    await page.getByRole('button', { name: 'Start new session' }).click();
    const questions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0].questions);
    expect(questions).toHaveLength(5);
    expect(questions.every((question) => question.level === level)).toBe(true);
  }
});

test('Progress milestones expose earned state without relying on color', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:completed-lessons', JSON.stringify(['lesson-l0-002']));
  });
  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();

  const list = page.locator('#milestone-row');
  await expect(list).toHaveAttribute('role', 'list');
  const milestones = list.locator('[role="listitem"]');
  await expect(milestones).toHaveCount(6);
  await expect(milestones.first()).toContainText('Earned');
  await expect(milestones.nth(1)).toContainText('Not earned');
  await expect(milestones.first()).toHaveAttribute('aria-label', /: earned$/);
  await expect(milestones.nth(1)).toHaveAttribute('aria-label', /: not earned$/);
});
