import { expect, test } from '@playwright/test';
import { installReviewState } from './review-state.js';

const triggerShortcut = async (locator, key, code) => {
  await locator.dispatchEvent('keydown', { key, code, bubbles: true, cancelable: true });
};

const solvePracticePrompt = (prompt) => {
  const addMatch = prompt.match(/Start from (\d+)\. Add (\d+)\./);
  if (addMatch) return Number(addMatch[1]) + Number(addMatch[2]);

  const subtractMatch = prompt.match(/Start from (\d+)\. Subtract (\d+)\./);
  if (subtractMatch) return Number(subtractMatch[1]) - Number(subtractMatch[2]);

  throw new Error(`Unsupported practice prompt: ${prompt}`);
};

const solveWorksheetPrompt = (prompt) => {
  const normalized = prompt.replace('×', '*').replace('÷', '/');
  const tokens = normalized.split(' ');
  let total = Number(tokens[0]);

  for (let index = 1; index < tokens.length; index += 2) {
    const operator = tokens[index];
    const value = Number(tokens[index + 1]);
    if (operator === '+') total += value;
    else if (operator === '-') total -= value;
    else if (operator === '*') total *= value;
    else if (operator === '/') total /= value;
  }

  return total;
};

test('practice Enter verifies and advances on correct answer', async ({ page }) => {
  await page.goto('practice');

  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-format', 'single');
  await page.selectOption('#session-type', 'generated');
  await page.selectOption('#session-level', 'L1');
  await page.selectOption('#session-length', '5');
  await page.getByRole('button', { name: 'Start new session' }).click();

  await expect(page.locator('#session-progress')).toContainText('Question 1 / 5');
  const prompt = await page.locator('#question-prompt').textContent();
  const answer = solvePracticePrompt(prompt ?? '');

  await page.locator('#answer-input').fill(String(answer));
  await page.locator('#answer-input').press('Enter');

  await expect(page.locator('#session-progress')).toContainText('Question 2 / 5');
});

test('explicit foundations intent launches a focused session immediately', async ({ page }) => {
  await page.goto('practice?level=L0&skill=abacus-orientation&start=1');

  await expect(page.locator('#session-title')).toContainText('abacus orientation · L0 session');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 5');
});

test('focused practice defaults new learners to foundations and focuses the answer', async ({ page }) => {
  await page.goto('practice?level=L0&skill=abacus-orientation&start=1');

  await expect(page.locator('#session-title')).toContainText('abacus orientation · L0 session');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 5');
  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#question-prompt')).toBeInViewport();
  await expect(page.locator('#answer-input')).toBeInViewport();
  await expect(page.locator('#visual-mount')).toHaveAttribute('role', 'img');
  await expect(page.locator('#visual-mount')).toHaveAttribute('aria-label', /showing \d+/);
});

test('history resume returns keyboard focus to the active question', async ({ page }) => {
  await page.goto('practice?level=L0&skill=abacus-orientation&start=1');
  await page.reload();

  const resume = page.locator('#history-list .session-card').first().getByRole('button', { name: /^Resume .* session dojo-/ });
  await expect(resume).toHaveCount(1);
  await resume.click();

  await expect(page.locator('#answer-input')).toBeFocused();
  await expect(page.locator('#practice-session-context')).toBeVisible();
});

test('history and latest-session controls reject malformed generic sessions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([{
      id: 'malformed-generic-session',
      type: 'generated',
      level: 'L3',
      completed: false,
      currentIndex: 0,
      questions: [{ id: 'missing-required-question-fields' }],
      responses: {},
    }]));
  });

  await page.goto('practice');

  const card = page.locator('#history-list .session-card').first();
  await expect(card.getByRole('button', { name: /Resume unavailable for/ })).toBeDisabled();
  await expect(card.getByRole('button', { name: /Replay unavailable for/ })).toBeDisabled();
  await page.getByText('Adjust session setup').click();
  await page.locator('#resume-latest').click();
  await expect(page.locator('#feedback-panel')).toContainText('incomplete or malformed and cannot be resumed safely');
  await expect(page.locator('#session-id')).toHaveText('—');
});

test('lesson practice link preserves its level and starts immediately', async ({ page }) => {
  await page.goto('lessons/l4/first-division-patterns');

  await page.getByRole('link', { name: 'Practice this level' }).click();

  await expect(page).toHaveURL(/practice\/?\?level=L4&skill=division&start=1/);
  await expect(page.locator('#session-title')).toContainText('division · L4 session');
  await expect(page.locator('#sheet-list .input').first()).toBeFocused();
  await expect(page.locator('#sheet-list .sheet-prompt').first()).toBeInViewport();
  await expect(page.locator('#sheet-list .input').first()).toBeInViewport();
  const divisionSession = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0]);
  expect(divisionSession.skill).toBe('division');
  expect(divisionSession.questions.every((question) => question.skill === 'division' && question.prompt.includes('÷'))).toBe(true);
});

test('contextual addition practice does not mix in subtraction', async ({ page }) => {
  await page.goto('practice?level=L1&skill=addition&start=1');

  await expect(page.locator('#session-title')).toContainText('addition · L1 session');
  const session = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]')[0]);
  expect(session.skill).toBe('addition');
  expect(session.questions.every((question) => question.prompt.includes('Add') && !question.prompt.includes('Subtract'))).toBe(true);
});

test('practice journey can launch multiplication and division training', async ({ page }) => {
  await page.goto('practice');

  await page.getByText('More ways to train').click();
  await page.locator('.practice-journey-start[data-journey="muldiv"]').click();

  await expect(page.locator('#session-title')).toContainText('Multiply and divide journey');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 10');
  await expect(page.locator('#session-profile')).toContainText('Profile');
});

test('practice challenge can launch anzan burst mode', async ({ page }) => {
  await page.goto('practice');

  await page.getByText('More ways to train').click();
  await page.locator('.practice-challenge-start[data-challenge="anzan-burst"]').click();

  await expect(page.locator('#session-title')).toContainText('Anzan burst challenge');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 10');
  await expect(page.locator('#session-challenge-copy')).toContainText('8 of 10');
});

test('practice adaptive next move updates from weakness history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
    }));
  });

  await page.goto('practice');

  const recommendation = page.locator('[data-continuity-next-action]');
  await expect(recommendation).toHaveAttribute('data-continuity-kind', 'review');
  await expect(recommendation).toContainText('Repair quotient building next');
  await expect(recommendation.getByRole('link', { name: 'Open matching worksheet' })).toHaveAttribute('href', /submode=quotient-building/);
});

test('adaptive Practice captures retained first-check focus and incomplete-history basis', async ({ page }) => {
  await installReviewState(page, {
    firstCheckSkill: 'division',
    activitySkills: ['complements', 'complements'],
    incomplete: true,
  });

  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-level', 'L4');
  await page.selectOption('#question-style', 'adaptive');
  await page.getByRole('button', { name: 'Start new session' }).click();

  await expect(page.locator('#session-title')).toContainText('division · L4 session');
  await expect(page.locator('#session-adaptive-note')).toContainText('quotient building at L4');
  await expect(page.locator('#session-adaptive-note')).toContainText('answer from your first unassisted check');
  await expect(page.locator('#session-adaptive-note')).toContainText('known misses stay in review');
});

test('focused Practice deep links normalize incompatible level and skill pairs', async ({ page }) => {
  await page.goto('practice?level=L2&skill=division&start=1');
  await expect(page).toHaveURL(/practice\?level=L4&skill=division&start=1$/);
  await expect(page.locator('#session-title')).toHaveText('division · L4 session');

  await page.goto('practice?level=L5&skill=complements&start=1');
  await expect(page).toHaveURL(/practice\?level=L2&skill=complements&start=1$/);
  await expect(page.locator('#session-title')).toHaveText('complements · L2 session');
});

test('worksheet shortcuts clear, backspace, and advance after correct Enter', async ({ page }) => {
  await page.goto('worksheets');

  const firstInput = page.locator('.worksheet-input').first();
  await firstInput.fill('123');
  await triggerShortcut(firstInput, '-', 'NumpadSubtract');
  await expect(firstInput).toHaveValue('12');
  await triggerShortcut(firstInput, '*', 'NumpadMultiply');
  await expect(firstInput).toHaveValue('');

  const prompt = await firstInput.getAttribute('data-prompt');
  const answer = solveWorksheetPrompt(prompt ?? '');
  await firstInput.fill(String(answer));
  await firstInput.press('Enter');

  await expect(page.locator('.worksheet-input').nth(1)).toBeFocused();
});

test('exercise shortcuts clear, backspace, and Enter verifies expected value', async ({ page }) => {
  await page.goto('exercises/l1/add-two-and-three');

  const input = page.locator('#exercise-response');
  await input.fill('123');
  await triggerShortcut(input, '-', 'NumpadSubtract');
  await expect(input).toHaveValue('12');
  await triggerShortcut(input, '*', 'NumpadMultiply');
  await expect(input).toHaveValue('');

  await input.fill('5');
  await input.press('Enter');

  await expect(page.locator('#exercise-state-status')).toContainText('Correct');
});
