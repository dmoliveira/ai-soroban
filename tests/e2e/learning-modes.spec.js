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

test('Ten Bridge launches exact certified decompositions and replays its seed', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="ten-bridge"]').click();

  await expect(page.locator('#session-title')).toContainText('Ten Bridge challenge');
  const started = await readLatestSession(page);
  expect(started.challengeKey).toBe('ten-bridge');
  expect(started.questions).toHaveLength(10);
  const pairKeys = new Set();
  started.questions.forEach((question) => {
    const { start, addend, complement, remainder } = question.challengeData;
    expect(start + addend).toBeGreaterThanOrEqual(11);
    expect(start + addend).toBeLessThanOrEqual(18);
    expect(complement).toBe(10 - start);
    expect(remainder).toBe(addend - complement);
    pairKeys.add([start, addend].sort((left, right) => left - right).join(':'));
  });
  expect(pairKeys.size).toBe(10);

  for (const question of started.questions) await answerCurrentQuestion(page, question.answer);
  await expect(page.locator('#session-challenge-copy')).toContainText('Target met');
  await page.locator('#session-replay-current').click();
  const replay = await readLatestSession(page);
  expect(replay.challengeSeed).toBe(started.challengeSeed);
  expect(replay.questions).toEqual(started.questions);
});

test('a first-check challenge answer explains whether it counts', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  const session = await readLatestSession(page);
  await page.locator('#answer-input').fill(String(session.questions[0].answer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('counts toward the challenge target');
  await expect(page.locator('#feedback-panel')).toBeInViewport();
});

test('review opened after a correct first check does not contradict earned credit', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  const session = await readLatestSession(page);
  await page.locator('#answer-input').fill(String(session.questions[0].answer));
  await page.locator('#verify-answer').click();
  await page.locator('#reveal-steps').click();
  await expect(page.locator('#feedback-panel')).toContainText('counts toward the challenge target');
  await expect(page.locator('#feedback-panel')).toContainText('Review opened after the scored first check');
});

test('a stale challenge tab cannot replace a reveal with first-check credit', async ({ page, context }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  const session = await readLatestSession(page);

  const staleTab = await context.newPage();
  await staleTab.goto('practice');
  await staleTab.locator('.practice-setup-block > summary').click();
  await staleTab.locator('#resume-latest').click();

  await page.locator('#reveal-final').click();
  await staleTab.locator('#answer-input').fill(String(session.questions[0].answer));
  await staleTab.locator('#verify-answer').click();
  await expect(staleTab.locator('#feedback-panel')).toContainText('does not count toward the first-check target');
  const merged = await staleTab.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1'))[0]);
  expect(merged.eligibility).toBe('activity-only');
  expect(merged.events.map((event) => event.kind)).toEqual(['reveal-final', 'submit']);
  await staleTab.close();
});

test('challenge completion stores a measured outcome and replays the certified list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(page.locator('#feedback-panel')).toBeFocused();
  await expect(page.locator('#session-start-fresh')).toBeInViewport();
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
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  const beadSession = await readLatestSession(page);

  await page.locator('#answer-input').fill(String(beadSession.questions[0].answer + 1));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('First check missed');
  await expect(page.locator('#feedback-panel')).toBeInViewport();
  await page.locator('#answer-input').fill(String(beadSession.questions[0].answer));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('Correction is right, but it does not count');
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

test('finite mini-game settings expose the required Number Bond and Flash defaults', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('mini-games');

  await expect(page.locator('#mini-game-title')).toHaveText('Number Bond Blitz');
  await expect(page.locator('#mini-game-question-count')).toHaveValue('10');
  await expect(page.locator('#mini-game-time-limit')).toHaveValue('30');
  await expect(page.locator('#mini-game-time-limit option[value="0"]')).toHaveText('No time limit');
  await expect(page.locator('[data-setting="question-count"]')).toBeVisible();
  await expect(page.locator('[data-setting="time-limit"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Start round$/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Configure Flash Anzan' }).click();
  await expect(page.locator('#mini-game-title')).toHaveText('Flash Anzan');
  await expect(page.locator('#mini-game-title')).toBeFocused();
  await expect(page.locator('#mini-game-term-count')).toHaveValue('20');
  await expect(page.locator('#mini-game-term-interval')).toHaveValue('1000');
  await expect(page.locator('[data-setting="term-count"]')).toBeVisible();
  await expect(page.locator('[data-setting="term-interval"]')).toBeVisible();
  await expect(page.locator('#mini-game-term-count')).toBeInViewport();
  await expect(page.locator('#mini-game-term-interval')).toBeInViewport();
  await expect(page.locator('#mini-game-rule')).toContainText('Terms appear one at a time');
  await expect(page.locator('#mini-game-accessibility-note')).toContainText('untimed equivalent');
});

test('Number Bond Blitz completes its finite queue and Play Again keeps settings', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('mini-games');
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-start-selected').click();

  for (let index = 0; index < 5; index += 1) {
    const prompt = await page.locator('#mini-game-prompt').textContent();
    const match = prompt.match(/completes (\d+) to (\d+)/);
    expect(match).not.toBeNull();
    await page.locator('#mini-game-answer').fill(String(Number(match[2]) - Number(match[1])));
    await page.locator('#mini-game-check').click();
  }

  const results = page.locator('#mini-game-results');
  await expect(results).toBeVisible();
  await expect(page.locator('#mini-game-result-title')).toBeFocused();
  await expect(page.locator('#mini-game-result-reason')).toContainText('end of the question list');
  await expect(page.locator('#mini-game-result-score')).toHaveText('100');
  await expect(page.locator('#mini-game-result-points')).toHaveText('80');
  await expect(page.locator('#mini-game-result-accuracy')).toHaveText('5 / 5');
  await expect(page.locator('#mini-game-result-time')).toHaveText(/\d+:\d{2}/);
  await expect(page.locator('#mini-game-play-again')).toBeVisible();
  await expect(page.locator('#mini-game-play-again')).toBeInViewport();
  const savedBest = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores') || '{}')['complement-dash']);
  expect(savedBest).toBeUndefined();
  const comparableBest = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores-v2') || '{}').bestByScope)[0]);
  expect(comparableBest.normalized).toBe(100);
  expect(comparableBest.rawPoints).toBe(80);

  await page.locator('#mini-game-play-again').click();
  await expect(page.locator('#mini-game-question-count')).toHaveValue('5');
  await expect(page.locator('#mini-game-progress')).toHaveText('0 / 5');
  await page.locator('#mini-game-stop').click();
  await expect(page.locator('#mini-game-result-reason')).toContainText('partial score was not saved');
  const bestAfterStop = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores') || '{}')['complement-dash']);
  expect(bestAfterStop).toBeUndefined();
});

test('Bead Builder completes through legal bead controls and resets ephemeral state', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('mini-games');
  await page.getByRole('button', { name: 'Configure Bead Builder' }).click();
  await expect(page.locator('#mini-game-title')).toHaveText('Bead Builder');
  await expect(page.locator('#mini-game-title')).toBeFocused();
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-start-selected').click();

  await expect(page.locator('#mini-game-bead-builder')).toBeVisible();
  await expect(page.locator('#mini-game-numeric-answer')).toBeHidden();
  await expect(page.locator('#mini-builder-upper')).toBeFocused();
  await expect(page.locator('#mini-game-check')).toHaveText('Check beads');
  await page.locator('#mini-builder-upper').press('Space');
  await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 5');
  await page.locator('#mini-builder-upper').press('Enter');
  await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 0');

  for (let index = 0; index < 5; index += 1) {
    await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 0');
    const prompt = await page.locator('#mini-game-prompt').textContent();
    const target = Number(prompt.match(/Build (\d+) on the rod/)?.[1]);
    expect(Number.isInteger(target)).toBe(true);
    if (target >= 5) await page.locator('#mini-builder-upper').click();
    const lower = target % 5;
    if (lower > 0) await page.locator(`[data-builder-lower="${lower}"]`).click();
    await expect(page.locator('#mini-builder-status')).toContainText(`Current rod value: ${target}`);
    await page.locator('#mini-game-check').click();
  }

  await expect(page.locator('#mini-game-results')).toBeVisible();
  await expect(page.locator('#mini-game-result-title')).toBeFocused();
  await expect(page.locator('#mini-game-result-score')).toHaveText('100');
  const scoreStore = await page.evaluate(() => localStorage.getItem('soroban-dojo:minigame-scores-v2') || '');
  expect(scoreStore).toContain('bead-builder');
  expect(scoreStore).not.toContain('upperActive');
  expect(scoreStore).not.toContain('lowerActive');

  await page.locator('#mini-game-play-again').click();
  await expect(page.locator('#mini-game-question-count')).toHaveValue('5');
  await expect(page.locator('#mini-game-progress')).toHaveText('0 / 5');
  await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 0');
  await expect(page.locator('#mini-builder-upper')).toBeFocused();
  await page.locator('#mini-game-stop').click();
  await expect(page.locator('#mini-game-result-reason')).toContainText('partial score was not saved');
  await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 0');
});

test('Number Bond deadline completes through the browser clock without a real wait', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('mini-games');
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-time-limit').selectOption('15');
  await page.locator('#mini-game-start-selected').click();

  await page.clock.fastForward(15_000);
  await expect(page.locator('#mini-game-results')).toBeVisible();
  await expect(page.locator('#mini-game-result-reason')).toContainText('time limit');
  await expect(page.locator('#mini-game-result-accuracy')).toHaveText('0 / 0');
  await expect(page.locator('#mini-game-result-time')).toHaveText('0:15');
});

test('Flash Anzan cancels stopped callbacks and completes after one paced sequence', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('mini-games');
  await page.locator('.minigame-select[data-game="anzan-flash"]').click();
  await page.locator('#mini-game-term-count').selectOption('10');
  await page.locator('#mini-game-term-interval').selectOption('500');
  await page.locator('#mini-game-start-selected').click();

  await expect(page.locator('#mini-game-term-counter')).toHaveText('Term 1 / 10');
  await expect(page.locator('#mini-game-answer')).toBeDisabled();
  await page.locator('#mini-game-stop').click();
  await page.locator('#mini-game-play-again').click();
  await page.clock.fastForward(500);
  await expect(page.locator('#mini-game-term-counter')).toHaveText('Term 2 / 10');

  await page.clock.fastForward(4_500);
  await expect(page.locator('#mini-game-term-counter')).toHaveText('Term 10 / 10');
  await expect(page.locator('#mini-game-prompt-title')).toHaveText('Final total');
  await expect(page.locator('#mini-game-answer')).toBeEnabled();
  await expect(page.locator('#mini-game-answer')).toBeFocused();
  await page.locator('#mini-game-answer').fill('0');
  await page.locator('#mini-game-check').click();

  await expect(page.locator('#mini-game-results')).toBeVisible();
  await expect(page.locator('#mini-game-result-reason')).toContainText('final Flash Anzan answer');
  await expect(page.locator('#mini-game-play-again')).toBeVisible();
});

test('Stop completes every mini-game without changing legacy best scores', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:minigame-scores', JSON.stringify({
      'complement-dash': 500,
      'table-tower': 500,
      'anzan-flash': 500,
      'error-fix': 500,
    }));
    localStorage.setItem('soroban-dojo:minigame-medals', JSON.stringify({
      'complement-dash': 'gold',
      'table-tower': 'gold',
      'anzan-flash': 'gold',
      'error-fix': 'gold',
    }));
  });
  await page.goto('mini-games');
  await expect(page.locator('#mini-game-best')).toContainText('Legacy record only');
  await expect(page.locator('#mini-game-tier')).toHaveText('Unlocked tier: starter');
  await expect(page.locator('#mini-game-difficulty option[value="bronze"]')).toHaveAttribute('disabled', '');

  for (const gameId of ['complement-dash', 'table-tower', 'anzan-flash', 'error-fix', 'bead-builder']) {
    await page.locator(`.minigame-select[data-game="${gameId}"]`).click();
    await page.locator('#mini-game-start-selected').click();
    await expect(page.locator('#mini-game-stop')).toBeEnabled();
    await page.locator('#mini-game-stop').click();
    await expect(page.locator('#mini-game-results')).toBeVisible();
    await expect(page.locator('#mini-game-result-title')).toBeFocused();
    await expect(page.locator('#mini-game-result-score')).toHaveText('0');
    await expect(page.locator('#mini-game-result-time')).toHaveText(/\d+:\d{2}/);
    await expect(page.locator('#mini-game-play-again')).toBeVisible();
  }

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores') || '{}'));
  expect(scores).toEqual({ 'complement-dash': 500, 'table-tower': 500, 'anzan-flash': 500, 'error-fix': 500 });
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`active prompt, answer, and Stop stay together at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('mini-games');
    await page.locator('#mini-game-start-selected').click();
    await expect(page.locator('#mini-game-prompt')).toBeInViewport();
    await expect(page.locator('#mini-game-answer')).toBeInViewport();
    await expect(page.locator('#mini-game-stop')).toBeInViewport();
    await page.locator('#mini-game-stop').click();

    await page.getByRole('button', { name: 'Configure Flash Anzan' }).click();
    await page.locator('#mini-game-start-selected').click();
    await expect(page.locator('#mini-game-term-counter')).toBeInViewport();
    await expect(page.locator('#mini-game-prompt')).toBeInViewport();
    await expect(page.locator('#mini-game-stop')).toBeInViewport();
    await page.locator('#mini-game-stop').click();
  });
}

test('persisted challenge payloads are rebuilt canonically before resume', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="bead-match"]').click();
  await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]');
    sessions[0].questions[0].prompt = `Answer: ${sessions[0].questions[0].answer}`;
    sessions[0].questions[0].steps = [`Answer: ${sessions[0].questions[0].answer}`];
    sessions[0].challengeTitle = 'Forged challenge';
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify(sessions));
  });

  await page.reload();
  await page.locator('.practice-setup-block > summary').click();
  await page.locator('#resume-latest').click();
  await expect(page.locator('#session-title')).toContainText('Bead match challenge');
  await expect(page.locator('#question-prompt')).not.toContainText('Answer:');
  const restored = await readLatestSession(page);
  expect(restored.challengeTitle).toBe('Bead match');
  expect(restored.questions[0].prompt).not.toContain('Answer:');
});

test('wrong-shape local data falls back without crashing learning flows', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:completed-lessons', '{}');
    localStorage.setItem('soroban-dojo:exercise-states', '[]');
    localStorage.setItem('soroban-dojo:timer-history', '{}');
    localStorage.setItem('soroban-dojo:practice-sessions', '{}');
    localStorage.setItem('soroban-dojo:worksheet-sessions', '"wrong"');
    localStorage.setItem('soroban-dojo:boss-rounds', '[]');
    localStorage.setItem('soroban-dojo:minigame-scores', '"wrong"');
    localStorage.setItem('soroban-dojo:minigame-medals', '[]');
  });

  await page.goto('progress');
  await expect(page.locator('#finished-sessions')).toHaveText('0');
  await page.goto('practice');
  await page.locator('#start-practice-now').click();
  await expect(page.locator('#session-title')).toContainText('Generated L0 session');
  await page.goto('mini-games');
  await page.locator('#mini-game-start-selected').click();
  await page.locator('#mini-game-stop').click();
  await expect(page.locator('#mini-game-results')).toBeVisible();
});
