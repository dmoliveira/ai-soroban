import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'small phone', width: 320, height: 568 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop edge', width: 861, height: 900 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const viewport of viewports) {
  test(`${viewport.name} keeps core routes inside the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);

    for (const route of ['', 'practice', 'progress', 'worksheets', 'mini-games']) {
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth, `${route || 'home'} overflow at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }

    const header = page.locator('.site-header');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    if (viewport.width <= 860) {
      await expect(header).toHaveCSS('position', 'static');
      expect(headerBox.height).toBeLessThanOrEqual(190);
    } else {
      await expect(header).toHaveCSS('position', 'sticky');
      expect(headerBox.height).toBeLessThanOrEqual(120);
    }

    if (viewport.width <= 860) {
      const primaryNavBoxes = await page.locator('.nav-primary > a').evaluateAll((links) => links.map((link) => {
        const rect = link.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      }));
      expect(primaryNavBoxes).toHaveLength(4);
      primaryNavBoxes.forEach((box) => {
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
      });
    }

    await page.goto('practice?level=L0&skill=abacus-orientation&start=1');
    await expect(page.locator('#practice-session-context')).toBeVisible();
    await expect(page.locator('#single-session-active')).toBeVisible();
    await expect(page.locator('#question-prompt')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#visual-mount')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#answer-input')).toBeInViewport({ ratio: 1 });
  });
}

test('practice anchor and controls remain reachable on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('practice');

  await page.getByRole('link', { name: 'Start focused practice' }).click();
  await expect(page.locator('#practice-client')).toBeInViewport();

  const targets = page.locator('#practice-client button:visible, #practice-client summary:visible');
  const count = Math.min(await targets.count(), 12);
  for (let index = 0; index < count; index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
});

test('primary home and worksheet actions appear before secondary detail on a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('');
  await expect(page.getByRole('link', { name: 'Take the best next step' })).toBeInViewport();

  await page.goto('worksheets');
  await expect(page.getByRole('button', { name: 'Start solving current sheet' })).toBeInViewport();
});

test('core non-inline learning controls meet the 44px target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const routes = [
    { path: '', selector: '[data-learner-path-controls] .button' },
    { path: 'paths/children', selector: '[data-learner-path-controls] .button' },
    { path: 'worksheets', selector: '.operation-chip, .worksheet-input, .mini-action, .preset-button' },
    { path: 'lessons/l0/reading-a-single-digit', selector: '.detail-utility-row a, .lesson-nav-strip a, .button' },
    { path: 'exercises/l1/add-two-and-three', selector: '.detail-utility-row a, .button' },
    { path: 'mini-games', selector: '.mini-game-playfield button, .mini-game-setting select, .mini-tier-picker select, #mini-game-answer' },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    const shortTargets = await page.locator(route.selector).evaluateAll((nodes) => nodes
      .filter((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .map((node) => ({ text: node.textContent?.trim(), height: node.getBoundingClientRect().height }))
      .filter((entry) => entry.height < 44));
    expect(shortTargets, route.path).toEqual([]);
  }
});

test('contextual sheet practice shows its prompt and answer together on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('practice?level=L4&skill=division&start=1');

  await expect(page.locator('#sheet-list .sheet-prompt').first()).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#sheet-list .input').first()).toBeInViewport({ ratio: 1 });
  await expect(page.locator('#sheet-list .input').first()).toBeFocused();
});

for (const width of [320, 390]) {
  test(`worksheet row results and actions remain visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('worksheets');

    const row = page.locator('.ledger-row.worksheet-row').first();
    await expect(row).toBeVisible();
    const targets = row.locator('.worksheet-feedback, .worksheet-row-actions, .mini-action');
    const boxes = await targets.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    }));
    boxes.forEach((box) => {
      expect(box.width).toBeGreaterThan(0);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    });
  });
}
