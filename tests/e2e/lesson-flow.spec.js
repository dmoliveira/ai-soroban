import { expect, test } from '@playwright/test';

test('lesson mini-checks and completion reveal exact next moves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('soroban-dojo:completed-lessons');
  });

  await page.goto('/ai-soroban/lessons/l4/first-multiplication-patterns');

  await expect(page.locator('#lesson-complete-next')).toBeHidden();

  const miniInput = page.locator('.lesson-mini-input').first();
  await miniInput.fill('12');
  await page.getByRole('button', { name: 'Check' }).first().click();
  await expect(page.locator('.lesson-mini-feedback').first()).toContainText('Correct');

  await page.getByRole('button', { name: 'Mark lesson complete' }).click();
  await expect(page.locator('#lesson-complete-next')).toBeVisible();

  await page.getByRole('link', { name: 'Matching worksheet' }).click();
  await expect(page).toHaveURL(/preset=multiplication-focus/);
});

test('division lesson links into focused worksheet submodes', async ({ page }) => {
  await page.goto('/ai-soroban/lessons/l4/first-division-patterns');

  await page.getByRole('link', { name: 'Quotient-building worksheet' }).click();

  await expect(page).toHaveURL(/submode=quotient-building/);
  await expect(page.locator('#worksheet-focus-title')).toContainText('Division quotient building');
});

test('weekly study plan adapts to multiplication weakness', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'multiplication', sessionId: 'exercise:L4:multiplication' },
      b: { status: 'needs-review', level: 'L4', skill: 'multiplication', sessionId: 'exercise:L4:multiplication' },
    }));
  });

  await page.goto('/ai-soroban/study-plan');

  await expect(page.locator('#weekly-plan-title')).toContainText('Multiplication structure week');
  await expect(page.getByRole('link', { name: 'Open worksheet' }).last()).toHaveAttribute('href', /submode=place-shifts/);
});

test('weekly study plan steps can be marked done', async ({ page }) => {
  await page.goto('/ai-soroban/study-plan');

  const firstToggle = page.locator('.weekly-plan-toggle').first();
  await firstToggle.click();

  await expect(page.getByText('Completed for this week.').first()).toBeVisible();
  await expect(firstToggle).toContainText('Mark pending');
});

test('boss certificate preview updates after boss completion', async ({ page }) => {
  await page.goto('/ai-soroban/boss-rounds');

  await page.locator('#certificate-name').fill('Diego');
  await page.locator('.boss-round-toggle').first().click();

  await expect(page.locator('#certificate-copy')).toContainText('Diego');
  await expect(page.locator('#certificate-copy')).toContainText('L0');
});
