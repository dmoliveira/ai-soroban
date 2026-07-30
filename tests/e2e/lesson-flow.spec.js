import { expect, test } from '@playwright/test';
import { installReviewState } from './review-state.js';

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

test('weekly study plan refreshes when retained first-check focus replaces stale activity', async ({ page }) => {
  await installReviewState(page, {
    firstCheckSkill: 'division',
    activitySkills: ['multiplication', 'multiplication'],
  });

  await page.goto('study-plan');
  await expect(page.locator('#weekly-plan-title')).toHaveText('Division quotient week');
  await expect(page.locator('#weekly-plan-copy')).toContainText('answer from your first unassisted check');

  await page.evaluate(() => {
    const attempt = {
      version: 1,
      attemptId: 'review-complements',
      source: 'exercise',
      itemId: 'review-item-complements',
      skill: 'complements',
      level: 'L2',
      rule: { id: 'review-item-complements', version: 1 },
      eligibility: 'prospective',
      seed: null,
      startedAt: '2026-07-30T01:00:00.000Z',
      events: [{ seq: 1, kind: 'submit', at: '2026-07-30T01:00:01.000Z', value: 'wrong', correct: false }],
    };
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify([attempt]));
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify({
      version: 1,
      claims: [{ itemId: attempt.itemId, attemptId: attempt.attemptId, firstSeenAt: attempt.events[0].at }],
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'review:first-check:complete:division',
      planId: 'division',
      lesson: { id: 'lesson-l4-006', done: false },
      exercise: { id: 'exercise-l4-007', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=division-focus&submode=quotient-building', done: false },
    }));
  });
  await page.reload();

  await expect(page.locator('#weekly-plan-title')).toHaveText('Complements repair week');
  await expect(page.locator('#weekly-plan-copy')).toContainText('five and ten complements');
  await expect(page.locator('#weekly-plan-copy')).toContainText('answer from your first unassisted check');
});

test('weekly study plan rejects malformed done flags even when the saved route matches', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'default:new',
      planId: 'foundations',
      target: 'foundations',
      lesson: { id: 'lesson-l0-002', done: 'yes' },
      exercise: { id: 'exercise-l0-003', done: 'yes' },
      worksheet: { href: '/soroban-dojo/worksheets?preset=foundations-focus&submode=arithmetic-rhythm', done: 'yes' },
    }));
  });

  await page.goto('study-plan');

  await expect(page.locator('#weekly-plan-current')).toContainText('Current step');
  await expect(page.locator('#weekly-plan-current')).toContainText(/reading a single digit/i);
  await expect(page.getByRole('heading', { name: 'All planned steps are marked done' })).toHaveCount(0);
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

  await expect(page.getByRole('heading', { name: 'All planned steps are marked done' })).toBeFocused();
  await page.getByRole('button', { name: 'Mark lesson pending' }).click();
  await expect(page.locator('#weekly-plan-current .weekly-plan-toggle')).toBeFocused();
  await expect(page.locator('#weekly-plan-current')).toContainText('Reading a Single Digit');
});

test('weekly study plan preserves a future toggle and announces its saved state', async ({ page }) => {
  await page.goto('study-plan');

  const worksheetToggle = page.locator('.weekly-plan-toggle[data-step="worksheet"]');
  await worksheetToggle.click();

  await expect(page.locator('.weekly-plan-toggle[data-step="worksheet"]')).toBeFocused();
  await expect(page.locator('#weekly-plan-update-status')).toHaveText('Worksheet marked done for this week.');
  await expect(page.locator('#weekly-plan-current')).not.toHaveAttribute('aria-live', /.+/);
  await expect(page.locator('.weekly-plan-panel [role="status"]')).toHaveCount(1);
});

test('weekly study plan rolls back and reports a blocked write', async ({ page }) => {
  await page.goto('study-plan');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:weekly-study-plan') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });

  await page.locator('#weekly-plan-current .weekly-plan-toggle').click();

  await expect(page.locator('#weekly-plan-current')).toContainText('Reading a Single Digit');
  await expect(page.locator('.weekly-plan-toggle[data-step="lesson"]')).toBeFocused();
  await expect(page.locator('#weekly-plan-update-status')).toHaveText('Lesson was not changed because this browser could not save it.');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:weekly-study-plan'))).toBeNull();
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
