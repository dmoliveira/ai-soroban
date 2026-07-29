import { expect, test } from '@playwright/test';

const promptStructureSignature = (prompt) => prompt
  .split(' ')
  .filter((_, index) => index % 2 === 0)
  .map((value, index) => `${index === 0 ? 'start' : prompt.split(' ')[(index * 2) - 1]}:${value.length}`)
  .join('|');

test('3-4 digit sequence worksheet keeps every rendered operand in band', async ({ page }) => {
  await page.goto('worksheets');

  await page.getByText('More worksheet presets').click();
  await page.getByRole('button', { name: 'Sequence mix' }).click();
  await page.selectOption('#worksheet-band', '3-4');
  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-count', '40');
  await page.getByRole('button', { name: 'Refresh questions' }).click();

  await expect(page.locator('#worksheet-title')).toContainText('3-4 digit band');
  await expect(page.locator('.vertical-drill-row').first()).toBeVisible();

  const values = await page.locator('.vertical-drill-row .v-arith-value').allTextContents();
  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  const structureCount = new Set(prompts.map(promptStructureSignature)).size;
  expect(values.length).toBeGreaterThan(0);
  expect(new Set(prompts).size).toBe(prompts.length);
  expect(structureCount).toBeGreaterThanOrEqual(6);

  values.forEach((value) => {
    const digitsOnly = value.trim().replace(/\D/g, '');
    expect(digitsOnly.length).toBeGreaterThanOrEqual(3);
    expect(digitsOnly.length).toBeLessThanOrEqual(4);
  });
});

test('worksheet preset query opens focused multiplication drills', async ({ page }) => {
  await page.goto('worksheets?preset=multiplication-focus');

  await expect(page.locator('#worksheet-level')).toHaveValue('L4');
  await expect(page.locator('input[name="worksheet-family"][value="multiplication"]')).toBeChecked();
  await expect(page.locator('input[name="worksheet-family"][value="division"]')).not.toBeChecked();

  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  expect(prompts.length).toBeGreaterThan(0);
  prompts.forEach((prompt) => expect(prompt).toContain('×'));
  await expect(page.locator('#worksheet-band-guide')).toContainText('Every number shown in each drill stays inside the 2-4 digit band');
  await expect(page.locator('#worksheet-band-summary')).toContainText('Flow: Ramp up');
  await expect(page.locator('#worksheet-target-summary')).toContainText('Multiplication place shifts');
  await expect(page.locator('#worksheet-worked-title')).toContainText('Place-shift example');
  await expect(page.locator('#worksheet-worked-prompt')).toContainText('14 × 4');
  await expect(page.getByRole('button', { name: 'Multiplication' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Foundations' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Start solving current sheet' }).click();
  await expect(page.locator('.worksheet-input').first()).toBeFocused();
  await expect(page.locator('.worksheet-input').first()).toBeInViewport();
});

test('adaptive worksheet targets division weakness automatically', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      c: { status: 'needs-review', level: 'L2', skill: 'complements', sessionId: 'exercise:L2:complements' },
    }));
  });

  await page.goto('worksheets');
  await page.selectOption('#worksheet-mode', 'adaptive');
  await page.selectOption('#worksheet-level', 'L4');
  await page.getByRole('button', { name: 'Refresh questions' }).click();

  await expect(page.locator('#worksheet-target-summary')).toContainText('Division quotient building');
  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  expect(prompts.length).toBeGreaterThan(0);
  prompts.forEach((prompt) => expect(prompt).toContain('÷'));
});

test('worksheet seed stays stable for presentation rerenders and rotates on refresh', async ({ page }) => {
  await page.goto('worksheets?preset=sequence-mix');

  const inputs = page.locator('.worksheet-input');
  const initialIds = await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')));
  const initialAnswers = await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-answer')));
  expect(initialIds.every(Boolean)).toBe(true);
  expect(initialAnswers.every((answer) => /^\d+$/.test(answer || ''))).toBe(true);

  await inputs.first().fill(initialAnswers[0] || '');
  await page.getByText('After you generate').click();
  await page.getByRole('button', { name: 'Check answered' }).click();
  await expect(inputs.first().locator('xpath=ancestor::article[1]').locator('.worksheet-feedback')).toHaveClass(/vertical-feedback.*ok/);

  await inputs.nth(1).fill(initialAnswers[1] || '');
  await inputs.nth(1).press('Enter');
  await expect(inputs.nth(1).locator('xpath=ancestor::article[1]').locator('.worksheet-feedback')).toHaveClass(/vertical-feedback.*ok/);

  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-orientation', 'ledger');
  await expect(inputs.first()).toBeVisible();
  expect(await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')))).toEqual(initialIds);

  await page.getByRole('button', { name: 'Refresh questions' }).click();
  await expect(inputs.first()).toBeVisible();
  expect(await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')))).not.toEqual(initialIds);
});

test('worksheet scoring and teacher key use certified structured answers', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const firstInput = page.locator('.worksheet-input').first();
  const certifiedAnswer = await firstInput.getAttribute('data-answer');
  expect(certifiedAnswer).toMatch(/^\d+$/);
  await firstInput.evaluate((input) => input.setAttribute('data-prompt', '1 + 1'));
  await firstInput.fill(certifiedAnswer || '');
  await firstInput.press('Enter');
  await expect(firstInput.locator('xpath=ancestor::*[contains(@class,"worksheet-row") or contains(@class,"vertical-drill-row")]').locator('.worksheet-feedback')).toHaveText('✓');

  await page.getByText('After you generate').click();
  await page.getByRole('button', { name: 'Teacher key' }).click();
  await expect(page.locator('#worksheet-score-copy')).toContainText('Certified answer key');
  const revealed = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => ({
    answer: input.getAttribute('data-answer'),
    feedback: input.closest('.ledger-row, .vertical-drill-row')?.querySelector('.worksheet-feedback')?.textContent,
    family: input.getAttribute('data-family'),
  })));
  expect(revealed.every(({ answer, feedback, family }) => answer === feedback?.trim() && family === 'complement')).toBe(true);
});

test('adaptive complement weakness emits certified complement rows', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L2', skill: 'complements', sessionId: 'exercise:L2:complements' },
      b: { status: 'needs-review', level: 'L2', skill: 'complements', sessionId: 'exercise:L2:complements' },
    }));
  });

  await page.goto('worksheets');
  await page.selectOption('#worksheet-mode', 'adaptive');
  await page.selectOption('#worksheet-level', 'L2');
  await page.getByRole('button', { name: 'Refresh questions' }).click();

  await expect(page.locator('#worksheet-target-summary')).toContainText('Complement balance');
  const families = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-family')));
  expect(families.length).toBeGreaterThan(0);
  expect(families.every((family) => family === 'complement')).toBe(true);
});

test('worksheet falls back from wrong-shape local records after shared compatibility bootstrap', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', '[]');
    localStorage.setItem('soroban-dojo:worksheet-sessions', '"wrong"');
  });

  await page.goto('worksheets');
  await expect(page.locator('html')).toHaveAttribute('data-storage-writable', 'true');
  await expect(page.locator('.worksheet-input').first()).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:worksheet-sessions') || 'null'));
  expect(Array.isArray(sessions)).toBe(true);
});

test('worksheet preserves future-state sessions in shared read-only mode', async ({ page }) => {
  const futureSessions = '[{"id":"future-worksheet","futureField":true}]';
  await page.addInitScript((sessions) => {
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 99, migratedAt: 'future' }));
    localStorage.setItem('soroban-dojo:worksheet-sessions', sessions);
  }, futureSessions);

  await page.goto('worksheets');
  await expect(page.locator('html')).toHaveAttribute('data-storage-writable', 'false');
  await expect(page.locator('.worksheet-input').first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:worksheet-sessions'))).toBe(futureSessions);
});

test('curriculum mastery worksheet link opens anzan-focused sheet', async ({ page }) => {
  await page.goto('curriculum');
  await page.getByRole('link', { name: 'Anzan worksheet' }).click();

  await expect(page).toHaveURL(/preset=anzan-focus/);
  await expect(page.locator('#worksheet-level')).toHaveValue('L5');
  await expect(page.locator('input[name="worksheet-family"][value="anzan"]')).toBeChecked();
});

test('worksheet op-range controls switch fixed sheets to dynamic mode', async ({ page }) => {
  await page.goto('worksheets');

  await expect(page.locator('#worksheet-mode')).toHaveValue('fixed');
  await page.selectOption('#worksheet-op-max', '4');

  await expect(page.locator('#worksheet-mode')).toHaveValue('dynamic');
  await expect(page.locator('#worksheet-op-guide')).toContainText('Each drill can randomly use any operation count');
});
