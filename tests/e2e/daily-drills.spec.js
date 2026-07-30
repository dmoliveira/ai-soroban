import { expect, test } from '@playwright/test';
import { installReviewState } from './review-state.js';

test('daily drills adapt to unfinished weekly plan step and weak area', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'review:activity:complete:division',
      planId: 'division',
      target: 'division',
      title: 'Division quotient week',
      lesson: { id: 'lesson-l4-006', done: true },
      exercise: { id: 'exercise-l4-007', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=division-focus&submode=quotient-building', done: false },
    }));
  });

  await page.goto('daily-drills');
  await page.selectOption('#daily-level', 'L4');
  await page.getByRole('button', { name: 'Generate pack' }).click();

  await expect(page.locator('#daily-drill-focus')).toContainText('division');
  await expect(page.locator('#daily-drill-focus')).toContainText('exercise');
  await expect(page.locator('#daily-guidance-title')).toContainText(/Division quotient today|Division factor search today/);
  await expect(page.locator('#daily-link-worksheet')).toHaveAttribute('href', /submode=quotient-building/);
  await expect(page.locator('#daily-drill-list')).toContainText(/÷|factor/);
});

test('daily drills prefer retained first-check evidence and reject stale weekly plans', async ({ page }) => {
  await installReviewState(page, {
    firstCheckSkill: 'division',
    activitySkills: ['multiplication', 'multiplication', 'multiplication'],
  });
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'review:activity:complete:multiplication',
      planId: 'multiplication',
      target: 'multiplication',
      lesson: { id: 'lesson-l4-005', done: false },
      exercise: { id: 'exercise-l4-005', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=multiplication-focus', done: false },
    }));
  });

  await page.goto('daily-drills');

  await expect(page.locator('#daily-drill-focus')).toContainText('division');
  await expect(page.locator('#daily-drill-focus')).toContainText('No fresh weekly plan');
  await expect(page.locator('#daily-drill-copy')).toContainText('answer from your first unassisted check');
  await expect(page.locator('#daily-generate-status')).toContainText('Generated 8 division prompts for L4');
  await expect(page.getByRole('button', { name: /Reveal answer for drill 1:/ })).toHaveAttribute('aria-controls', 'daily-answer-1');
});

test('daily drills do not turn malformed weekly state into an unfinished lesson', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:weekly-study-plan', '{}');
  });

  await page.goto('daily-drills');

  await expect(page.locator('#daily-drill-focus')).toContainText('No fresh weekly plan');
  await expect(page.locator('#daily-guidance-primary-copy')).toContainText('No fresh weekly plan is linked');
  await expect(page.locator('#daily-drill-focus')).not.toContainText('unfinished lesson');
});

test('fresh foundations plans keep daily drills at L0', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'default:new',
      planId: 'foundations',
      target: 'foundations',
      lesson: { id: 'lesson-l0-002', done: false },
      exercise: { id: 'exercise-l0-003', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=foundations-focus&submode=arithmetic-rhythm', done: false },
    }));
  });

  await page.goto('daily-drills');

  await expect(page.locator('#daily-level')).toHaveValue('L0');
  await expect(page.locator('#daily-drill-focus')).toContainText('arithmetic');
  await expect(page.locator('#daily-drill-focus')).toContainText('unfinished step: lesson');
  await expect(page.locator('#daily-generate-status')).toContainText('for L0');
});

test('fresh beginner route plans keep daily drills at L1', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:path', 'adults');
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'path:adults',
      planId: 'beginner',
      target: 'beginner',
      lesson: { id: 'lesson-l1-002', done: false },
      exercise: { id: 'exercise-l1-003', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=one-rod-focus&submode=arithmetic-rhythm', done: false },
    }));
  });

  await page.goto('daily-drills');

  await expect(page.locator('#daily-level')).toHaveValue('L1');
  await expect(page.locator('#daily-drill-focus')).toContainText('arithmetic');
  await expect(page.locator('#daily-generate-status')).toContainText('for L1');
});
