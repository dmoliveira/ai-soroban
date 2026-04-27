import { expect, test } from '@playwright/test';

test('home prioritizes one calm next step', async ({ page }) => {
  await page.goto('');

  await expect(page.getByRole('heading', { level: 1, name: /choose one clear route/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /take the best next step/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /pick the route that fits the learner first/i })).toBeVisible();
});

test('start here presents a small-session onboarding flow', async ({ page }) => {
  await page.goto('start-here');

  await expect(page.getByRole('heading', { level: 1, name: /start in one calm sitting/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /use this three-step order/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /follow the learning map/i })).toBeVisible();
});

test('practice keeps a single h1 and stacks mode cards on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('practice');

  await expect(page.getByRole('heading', { level: 1, name: /start one short session/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: /choose one training mode and begin/i })).toBeVisible();

  const cards = page.locator('.practice-options > .option-grid').first().locator('> .choice-card');
  await expect(cards).toHaveCount(3);

  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(firstBox.x - secondBox.x)).toBeLessThan(2);
  expect(secondBox.y).toBeGreaterThan(firstBox.y);
});

test('secondary routes keep the more-routes group visible when active', async ({ page }) => {
  await page.goto('paths/children');

  const moreRoutes = page.locator('.nav-more');
  await expect(moreRoutes).toHaveAttribute('open', '');
  await expect(page.getByRole('link', { name: /children/i }).first()).toHaveAttribute('aria-current', 'page');
});

test('curriculum uses lighter stage guidance and clear stage actions', async ({ page }) => {
  await page.goto('curriculum');

  await expect(page.getByRole('heading', { level: 1, name: /follow one calm stage at a time/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /pick the stage that matches the learner right now/i })).toBeVisible();
  await expect(page.locator('.curriculum-stage-grid .curriculum-stage-card')).toHaveCount(7);
  await expect(page.getByRole('link', { name: /take the best next step/i }).first()).toBeVisible();
});

test('progress prioritizes next move and weekly plan before milestone rewards', async ({ page }) => {
  await page.goto('progress');

  await expect(page.getByRole('heading', { level: 1, name: /see the next move before everything else/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /your next 7 days/i })).toBeVisible();

  const weeklyPlanTop = await page.locator('.weekly-plan-panel').boundingBox();
  const progressSummaryTop = await page.locator('.progress-panel').boundingBox();
  expect(weeklyPlanTop).not.toBeNull();
  expect(progressSummaryTop).not.toBeNull();
  expect(weeklyPlanTop.y).toBeLessThan(progressSummaryTop.y);
});

test('worksheets presents a guided generator with one dominant initial action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('worksheets');

  await expect(page.getByRole('heading', { level: 2, name: /choose a preset, adjust essentials, then generate/i })).toBeVisible();
  await expect(page.locator('.worksheet-step-grid .worksheet-step-card')).toHaveCount(3);
  await expect(page.getByRole('button', { name: /generate worksheet/i })).toBeVisible();
  await expect(page.getByText(/after you generate/i)).toBeVisible();
});
