import { expect, test } from '@playwright/test';

const promptStructureSignature = (prompt) => prompt
  .split(' ')
  .filter((_, index) => index % 2 === 0)
  .map((value, index) => `${index === 0 ? 'start' : prompt.split(' ')[(index * 2) - 1]}:${value.length}`)
  .join('|');

test('3-4 digit sequence worksheet keeps every rendered operand in band', async ({ page }) => {
  await page.goto('/ai-soroban/worksheets');

  await page.getByRole('button', { name: 'Sequence mix' }).click();
  await page.selectOption('#worksheet-band', '3-4');
  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-count', '40');
  await page.getByRole('button', { name: 'Generate ledger' }).click();

  await expect(page.locator('#worksheet-title')).toContainText('3-4 digits');
  await expect(page.locator('.vertical-drill-row').first()).toBeVisible();

  const values = await page.locator('.vertical-drill-row .v-arith-value').allTextContents();
  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  const structureCount = new Set(prompts.map(promptStructureSignature)).size;
  expect(values.length).toBeGreaterThan(0);
  expect(new Set(prompts).size).toBe(prompts.length);
  expect(structureCount).toBeGreaterThanOrEqual(8);

  values.forEach((value) => {
    const digitsOnly = value.trim().replace(/\D/g, '');
    expect(digitsOnly.length).toBeGreaterThanOrEqual(3);
    expect(digitsOnly.length).toBeLessThanOrEqual(4);
  });
});

test('worksheet preset query opens focused multiplication drills', async ({ page }) => {
  await page.goto('/ai-soroban/worksheets?preset=multiplication-focus');

  await expect(page.locator('#worksheet-level')).toHaveValue('L4');
  await expect(page.locator('input[name="worksheet-family"][value="multiplication"]')).toBeChecked();
  await expect(page.locator('input[name="worksheet-family"][value="division"]')).not.toBeChecked();

  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  expect(prompts.length).toBeGreaterThan(0);
  prompts.forEach((prompt) => expect(prompt).toContain('×'));
  await expect(page.locator('#worksheet-band-guide')).toContainText('Every shown operand stays within 2-4 digits');
  await expect(page.locator('#worksheet-current-setup-copy')).toContainText('ramp up');
  await expect(page.locator('#worksheet-target-summary')).toContainText('place-shifts');
});

test('adaptive worksheet targets division weakness automatically', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      c: { status: 'needs-review', level: 'L2', skill: 'complements', sessionId: 'exercise:L2:complements' },
    }));
  });

  await page.goto('/ai-soroban/worksheets');
  await page.selectOption('#worksheet-mode', 'adaptive');
  await page.selectOption('#worksheet-level', 'L4');
  await page.getByRole('button', { name: 'Generate ledger' }).click();

  await expect(page.locator('#worksheet-target-summary')).toContainText('quotient-building');
  const prompts = await page.locator('.worksheet-input').evaluateAll((inputs) => inputs.map((input) => input.getAttribute('data-prompt') || ''));
  expect(prompts.length).toBeGreaterThan(0);
  prompts.forEach((prompt) => expect(prompt).toContain('÷'));
});

test('curriculum mastery worksheet link opens anzan-focused sheet', async ({ page }) => {
  await page.goto('/ai-soroban/curriculum');

  await page.getByRole('link', { name: 'Anzan worksheet' }).click();

  await expect(page).toHaveURL(/preset=anzan-focus/);
  await expect(page.locator('#worksheet-level')).toHaveValue('L5');
  await expect(page.locator('input[name="worksheet-family"][value="anzan"]')).toBeChecked();
});
