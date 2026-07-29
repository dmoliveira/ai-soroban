import { expect, test } from '@playwright/test';

test('lesson mini-checks and completion reveal exact next moves', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('soroban-dojo:completed-lessons');
  });

  await page.goto('lessons/l4/first-multiplication-patterns');

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
  await page.goto('lessons/l4/first-division-patterns');

  await page.getByRole('link', { name: 'Quotient-building worksheet' }).click();

  await expect(page).toHaveURL(/submode=quotient-building/);
  await expect(page.locator('#worksheet-focus-title')).toContainText('Division quotient building');
});

test('worked soroban visuals preserve authored chronology', async ({ page }) => {
  await page.goto('lessons/l3/mixed-two-digit-fluency');
  await expect(page.locator('.step-card strong')).toHaveText(['24', '31', '32']);
  await expect(page.locator('.soroban-board')).toHaveAttribute('role', 'img');
  await expect(page.locator('.soroban-board .rod').first()).toHaveAttribute('aria-hidden', 'true');
});

test('weekly study plan adapts to multiplication weakness', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'multiplication', sessionId: 'exercise:L4:multiplication' },
      b: { status: 'needs-review', level: 'L4', skill: 'multiplication', sessionId: 'exercise:L4:multiplication' },
    }));
  });

  await page.goto('study-plan');

  await expect(page.locator('#weekly-plan-title')).toContainText('Multiplication structure week');
  await expect(page.getByRole('link', { name: 'Open worksheet' }).last()).toHaveAttribute('href', /submode=place-shifts/);
});

test('weekly study plan steps can be marked done', async ({ page }) => {
  await page.goto('study-plan');

  const firstToggle = page.locator('#weekly-plan-current .weekly-plan-toggle');
  await firstToggle.click();

  await expect(page.locator('#weekly-plan-current')).toContainText('Current step');
  await expect(page.locator('#weekly-plan-current')).toContainText(/exercise/i);
  await expect(page.locator('#weekly-plan-current .weekly-plan-toggle')).toBeFocused();
  await expect(page.getByRole('button', { name: 'Mark lesson pending' })).toBeVisible();
});

test('weekly study plan keeps keyboard focus through all-complete and reopen states', async ({ page }) => {
  await page.goto('study-plan');

  for (let index = 0; index < 3; index += 1) {
    const toggle = page.locator('#weekly-plan-current .weekly-plan-toggle');
    await toggle.focus();
    await toggle.press('Space');
  }

  await expect(page.getByRole('heading', { name: 'Every planned step is complete' })).toBeFocused();
  await page.getByRole('button', { name: 'Mark lesson pending' }).click();
  await expect(page.locator('#weekly-plan-current .weekly-plan-toggle')).toBeFocused();
  await expect(page.locator('#weekly-plan-current')).toContainText('Reading a Single Digit');
});

test('boss certificate preview updates after boss completion', async ({ page }) => {
  await page.goto('boss-rounds');

  await page.locator('#certificate-name').fill('Diego');
  await page.locator('.boss-round-toggle').first().click();

  await expect(page.locator('#certificate-copy')).toContainText('Diego');
  await expect(page.locator('#certificate-copy')).toContainText('L0');
});

test('boss certificate text can be copied after completion', async ({ page }) => {
  await page.goto('boss-rounds');

  await page.locator('#certificate-name').fill('Diego');
  await page.locator('.boss-round-toggle').first().click();
  await page.locator('#copy-certificate').click();

  await expect(page.locator('#certificate-copy')).toContainText(/Copied to clipboard|Copy failed in this browser/);
});
