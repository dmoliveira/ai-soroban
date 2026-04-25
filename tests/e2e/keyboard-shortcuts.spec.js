import { expect, test } from '@playwright/test';

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

test('practice fast start launches a warm-up session immediately', async ({ page }) => {
  await page.goto('practice');

  await page.getByRole('button', { name: 'Start warm-up now' }).click();

  await expect(page.locator('#session-title')).toContainText('Curated L0 session');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 5');
});

test('practice journey can launch multiplication and division training', async ({ page }) => {
  await page.goto('practice');

  await page.locator('.practice-journey-start[data-journey="muldiv"]').click();

  await expect(page.locator('#session-title')).toContainText('Multiply and divide journey');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 15');
  await expect(page.locator('#session-profile')).toContainText('Profile');
});

test('practice challenge can launch anzan burst mode', async ({ page }) => {
  await page.goto('practice');

  await page.locator('.practice-challenge-start[data-challenge="anzan-burst"]').click();

  await expect(page.locator('#session-title')).toContainText('Generated L5 session');
  await expect(page.locator('#session-progress')).toContainText('Question 1 / 10');
});

test('practice adaptive next move updates from weakness history', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
    }));
  });

  await page.goto('practice');

  await expect(page.locator('#adaptive-next-title')).toContainText('Division quotient-building');
  await expect(page.locator('#adaptive-next-worksheet')).toHaveAttribute('href', /submode=quotient-building/);
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
