import { expect, test } from '@playwright/test';

import { CHALLENGE_LIST } from '../../src/lib/challenges.js';

const readLatestSession = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0]);

const answerCurrentQuestion = async (page, value) => {
  await page.locator('#answer-input').fill(String(value));
  await page.locator('#verify-answer').click();
  await page.locator('#next-question').click();
};

test('challenge cards publish exact targets and certified rules', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();

  for (const challenge of CHALLENGE_LIST) {
    const card = page.locator(`[data-challenge-card="${challenge.key}"]`);
    await expect(card).toContainText(`Target: ${challenge.target}`);
    await expect(card).toContainText(`Rule: ${challenge.rule}`);
  }
});

test('challenge completion stores a measured outcome and replays the certified list', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();

  await expect(page.locator('#session-title')).toContainText('Bead match challenge');
  const started = await readLatestSession(page);
  expect(started.challengeKey).toBe('bead-match');
  expect(started.challengeSeed).toBe(started.id);
  expect(started.challengeRuleVersion).toBe(1);
  expect(started.questions.map((question) => question.challengeData.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

  for (let index = 0; index < started.questions.length; index += 1) {
    const answer = index < 8 ? started.questions[index].answer : started.questions[index].answer + 1;
    await answerCurrentQuestion(page, answer);
  }

  await expect(page.locator('#session-challenge-copy')).toContainText('Target met');
  await expect(page.locator('#session-challenge-copy')).toContainText('8/10 first-check correct');
  await expect(page.locator('#session-complete-actions')).toBeVisible();
  const completed = await readLatestSession(page);
  expect(completed.challengeOutcome).toMatchObject({ valid: true, met: true, value: 8, threshold: 8 });

  await page.locator('#session-replay-current').click();
  const replay = await readLatestSession(page);
  expect(replay.id).not.toBe(completed.id);
  expect(replay.challengeSeed).toBe(completed.challengeSeed);
  expect(replay.questions).toEqual(completed.questions);
  expect(replay.responses).toEqual({});
  expect(replay.challengeOutcome).toBeNull();
});

test('wrong-then-correct and revealed sheet answers do not satisfy challenge integrity', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  const beadSession = await readLatestSession(page);

  await page.locator('#answer-input').fill(String(beadSession.questions[0].answer + 1));
  await page.locator('#verify-answer').click();
  await page.locator('#answer-input').fill(String(beadSession.questions[0].answer));
  await page.locator('#verify-answer').click();
  await page.locator('#next-question').click();
  for (let index = 1; index < beadSession.questions.length; index += 1) {
    await answerCurrentQuestion(page, beadSession.questions[index].answer);
  }
  const corrected = await readLatestSession(page);
  expect(corrected.responses[0].attempts).toBe(2);
  expect(corrected.challengeOutcome.value).toBe(9);

  await page.locator('.practice-challenge-start[data-challenge="table-ladder"]').click();
  const tableSession = await readLatestSession(page);
  await page.locator('#reveal-sheet-answers').click();
  const inputs = page.locator('#sheet-list .input');
  for (let index = 0; index < tableSession.questions.length; index += 1) {
    await inputs.nth(index).fill(String(tableSession.questions[index].answer));
  }
  await page.locator('#check-sheet').click();

  const revealed = await readLatestSession(page);
  expect(revealed.finalScore).toBe(100);
  expect(revealed.challengeOutcome).toMatchObject({ met: false, value: 0 });
  await expect(inputs.first()).toBeDisabled();

  await page.reload();
  await page.locator('.practice-setup-block > summary').click();
  await page.locator('#resume-latest').click();
  await expect(page.locator('#session-title')).toContainText('Table ladder challenge');
  await expect(page.locator('#session-challenge-copy')).toContainText('Target not met yet');

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#recent-sessions')).toContainText('Challenge · Table ladder');
  await expect(page.locator('#recent-sessions')).toContainText('Target not met yet');
});

test('manual setup changes clear challenge identity before a generic session starts', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-button[data-challenge="bead-match"]').click();
  await expect(page.locator('#practice-current-setup-copy')).toContainText('Challenge: Bead match');

  await page.locator('.practice-setup-block > summary').click();
  await page.locator('#session-length').selectOption('5');
  await expect(page.locator('#practice-current-setup-copy')).not.toContainText('Challenge:');
  await page.locator('#start-session').click();

  const session = await readLatestSession(page);
  expect(session.challengeKey).toBeNull();
  await expect(page.locator('#session-title')).toContainText('Generated L0 session');
});
