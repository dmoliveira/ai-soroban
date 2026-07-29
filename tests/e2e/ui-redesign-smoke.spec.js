import { expect, test } from '@playwright/test';

test('home prioritizes one calm next step', async ({ page }) => {
  await page.goto('');

  await expect(page.getByRole('heading', { level: 1, name: /choose one clear route/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /take the best next step/i })).toHaveCount(1);
  await expect(page.getByRole('link', { name: /take the best next step/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /pick the route that fits the learner first/i })).toBeVisible();
});

test('start here presents a small-session onboarding flow', async ({ page }) => {
  await page.goto('start-here');

  await expect(page.getByRole('heading', { level: 1, name: /start in one calm sitting/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /use this three-step order/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /follow the learning map/i })).toBeVisible();
});

test('practice keeps a single h1 and reveals stacked journeys on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('practice');

  await expect(page.getByRole('heading', { level: 1, name: /start one short session/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('.studio-hero .hero-actions .button')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 2, name: /choose one training mode and begin/i })).toBeVisible();

  await expect(page.locator('#start-practice-now')).toBeVisible();
  await expect(page.locator('.practice-start-panel .button:not(.button-secondary)')).toHaveCount(1);
  await expect(page.locator('#practice-session-context')).toBeHidden();
  await expect(page.locator('#single-session-active')).toBeHidden();

  const [sessionBox, moreOptionsBox, sidePanelBox] = await Promise.all([
    page.locator('#practice-session').boundingBox(),
    page.locator('.practice-more-panel').boundingBox(),
    page.locator('.side-panel').boundingBox(),
  ]);
  expect(sessionBox).not.toBeNull();
  expect(moreOptionsBox).not.toBeNull();
  expect(sidePanelBox).not.toBeNull();
  expect(sessionBox.y).toBeLessThan(moreOptionsBox.y);
  expect(moreOptionsBox.y).toBeLessThan(sidePanelBox.y);

  await page.getByText('More ways to train').click();
  const cards = page.locator('.practice-journey-grid > .choice-card');
  await expect(cards).toHaveCount(5);

  const firstBox = await cards.nth(0).boundingBox();
  const secondBox = await cards.nth(1).boundingBox();

  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  expect(Math.abs(firstBox.x - secondBox.x)).toBeLessThan(2);
  expect(secondBox.y).toBeGreaterThan(firstBox.y);
});

test('practice keeps optional routes below the live session beside history on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('practice');

  const [sessionBox, moreOptionsBox, sidePanelBox] = await Promise.all([
    page.locator('#practice-session').boundingBox(),
    page.locator('.practice-more-panel').boundingBox(),
    page.locator('.side-panel').boundingBox(),
  ]);
  expect(sessionBox).not.toBeNull();
  expect(moreOptionsBox).not.toBeNull();
  expect(sidePanelBox).not.toBeNull();
  expect(Math.abs(sessionBox.x - moreOptionsBox.x)).toBeLessThan(2);
  expect(moreOptionsBox.y).toBeGreaterThan(sessionBox.y);
  expect(sidePanelBox.x).toBeGreaterThan(sessionBox.x + sessionBox.width);
  expect(Math.abs(sidePanelBox.y - sessionBox.y)).toBeLessThan(2);
});

test('secondary routes stay discoverable and expose current page', async ({ page }) => {
  await page.goto('paths/children');

  const moreRoutes = page.locator('.nav-more');
  await expect(moreRoutes).not.toHaveAttribute('open', '');
  await moreRoutes.getByText('Explore more').click();
  await expect(page.getByRole('link', { name: /children/i }).first()).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /learn/i }).first()).toHaveAttribute('aria-current', 'location');
});

test('nested learning routes expose their current navigation location', async ({ page }) => {
  await page.goto('lessons/l0/reading-a-single-digit');
  await expect(page.getByRole('link', { name: /learn/i }).first()).toHaveAttribute('aria-current', 'location');
  await page.getByText('Explore more').click();
  await expect(page.getByRole('link', { name: /lessons/i }).first()).toHaveAttribute('aria-current', 'location');
});

test('mobile header is compact and keeps task navigation usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');

  const moreRoutes = page.locator('.nav-more');
  await expect(moreRoutes.getByText('Explore more')).toBeVisible();
  await expect(page.getByRole('link', { name: /start/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /progress/i }).first()).toBeVisible();

  const headerBox = await page.locator('.site-header').boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox.height).toBeLessThanOrEqual(190);
  await expect(page.locator('.site-header')).toHaveCSS('position', 'static');

  const skipLink = page.getByRole('link', { name: 'Skip to content' });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(1);

  await moreRoutes.getByText('Explore more').click();
  const secondaryBoxes = await page.locator('.nav-secondary > a').evaluateAll((links) => links.map((link) => {
    const rect = link.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  }));
  expect(secondaryBoxes).toHaveLength(12);
  secondaryBoxes.forEach((box) => {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(391);
  });
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

test('worksheets presents a live preset flow with one dominant solve action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('worksheets');

  await expect(page.getByRole('heading', { level: 1, name: /printable worksheet studio/i })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /choose a preset; the sheet updates immediately/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /start solving current sheet/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /refresh questions/i })).toBeVisible();
  await expect(page.getByText(/after you generate/i)).toBeVisible();

  await page.getByText('More worksheet presets').click();
  const extraPresets = page.locator('.worksheet-preset-disclosure .worksheet-preset-row');
  await expect(extraPresets.getByRole('button', { name: 'Foundations' })).toHaveCount(0);
  await expect(extraPresets.getByRole('button', { name: 'Mixed fluency' })).toHaveCount(0);
  await expect(extraPresets.getByRole('button', { name: 'Multiplication' })).toHaveCount(0);
  await expect(extraPresets.getByRole('button', { name: 'Complements' })).toHaveCount(0);
});

test('placement self-check exposes clear selectable answers', async ({ page }) => {
  await page.goto('assessments');

  const firstGroup = page.locator('#placement-questions fieldset').first();
  await expect(firstGroup).toBeVisible();
  await expect(page.getByRole('button', { name: /get my recommendation/i })).toBeDisabled();

  await firstGroup.getByText('Sometimes', { exact: true }).click();
  await expect(firstGroup.getByRole('radio', { name: 'Sometimes' })).toBeChecked();
});

test('mini-games keeps answer controls inactive until a finite game starts', async ({ page }) => {
  await page.goto('mini-games');

  await expect(page.getByRole('button', { name: /check answer/i })).toBeDisabled();
  await expect(page.getByRole('button', { name: /stop session/i })).toBeDisabled();
  await expect(page.getByLabel('Answer')).toBeDisabled();
  await expect(page.getByLabel('Questions')).toHaveValue('10');
  await expect(page.getByLabel('Time limit')).toHaveValue('30');

  await page.getByRole('button', { name: /start selected game/i }).click();
  await expect(page.getByRole('button', { name: /check answer/i })).toBeEnabled();
  await expect(page.getByRole('button', { name: /stop session/i })).toBeEnabled();
  await expect(page.getByLabel('Answer')).toBeEnabled();
  await expect(page.getByLabel('Answer')).toBeFocused();
});
