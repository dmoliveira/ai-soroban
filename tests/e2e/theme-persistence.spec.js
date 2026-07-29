import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { THEMES } from '../../src/lib/themes.js';

const themeIds = THEMES.map(({ id }) => id);
const representativeRoutes = [
  '', 'start-here', 'assessments', 'curriculum', 'lessons', 'lessons/l0/reading-a-single-digit',
  'exercises', 'exercises/l1/add-two-and-three', 'levels', 'levels/l0', 'levels/l0/circuits',
  'practice', 'worksheets', 'progress', 'study-plan', 'daily-drills', 'mini-games', 'boss-rounds',
  'paths/children', 'paths/adults', 'about', 'support', 'privacy', 'releases',
];
const highRiskRoutes = ['practice', 'worksheets', 'mini-games', 'lessons/l0/reading-a-single-digit', 'exercises/l1/add-two-and-three'];

const builtRoutes = () => {
  const dist = path.resolve(import.meta.dirname, '../../dist');
  if (!fs.existsSync(dist)) return representativeRoutes;
  const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(resolved) : resolved.endsWith('.html') ? [resolved] : [];
  });
  return walk(dist)
    .map((file) => path.relative(dist, file).replace(/(^|\/)index\.html$/, '').replace(/\.html$/, ''))
    .filter((route) => route !== '404')
    .sort();
};

const seedTheme = async (page, themeId) => {
  await page.addInitScript((id) => {
    if (sessionStorage.getItem('soroban-dojo:theme-seeded')) return;
    localStorage.setItem('soroban-dojo:theme', id);
    sessionStorage.setItem('soroban-dojo:theme-seeded', '1');
  }, themeId);
};

test('theme selector exposes exactly three accessible raw-string choices', async ({ page }) => {
  await page.goto('');
  const selector = page.getByLabel('Theme');
  await expect(selector).toHaveValue('washi');
  await expect(selector.locator('option')).toHaveCount(3);
  await expect(selector.locator('option')).toHaveText(['Washi', 'Sakura', 'Sumi']);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'washi');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F5F0E7');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:theme'))).toBeNull();
});

test('theme selection persists raw, survives navigation, and keeps selector focus', async ({ page }) => {
  await page.goto('');
  const selector = page.getByLabel('Theme');
  await selector.selectOption('sakura');
  await expect(selector).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#FFF4F2');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:theme'))).toBe('sakura');

  await page.goto('practice');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');
  await expect(page.getByLabel('Theme')).toHaveValue('sakura');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sakura');

  await page.getByLabel('Theme').selectOption('sumi');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sumi');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#171716');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

test('production prepaint bootstrap honors Sumi and rejects quoted or unknown values', async ({ page }) => {
  await seedTheme(page, 'sumi');
  await page.goto('');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sumi');
  await expect(page.getByLabel('Theme')).toHaveValue('sumi');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#171716');

  await page.evaluate(() => localStorage.setItem('soroban-dojo:theme', '"sakura"'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'washi');
  await expect(page.getByLabel('Theme')).toHaveValue('washi');

  await page.evaluate(() => localStorage.setItem('soroban-dojo:theme', 'unknown'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'washi');
});

test('a storage write failure still applies the theme and reports the limitation', async ({ page }) => {
  for (const width of [320, 360, 861, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('');
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === 'soroban-dojo:theme') throw new Error('blocked');
        return original.call(this, key, value);
      };
    });
    await page.getByLabel('Theme').selectOption('sumi');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sumi');
    const status = page.locator('#theme-status');
    const navigation = page.locator('.nav-primary');
    await expect(status).toBeVisible();
    await expect(status).toContainText('could not save it');
    const [statusBox, navigationBox] = await Promise.all([status.boundingBox(), navigation.boundingBox()]);
    const overlap = Math.max(0, Math.min(statusBox.x + statusBox.width, navigationBox.x + navigationBox.width) - Math.max(statusBox.x, navigationBox.x))
      * Math.max(0, Math.min(statusBox.y + statusBox.height, navigationBox.y + navigationBox.height) - Math.max(statusBox.y, navigationBox.y));
    expect(overlap, `${width}px storage feedback must not cover primary navigation`).toBe(0);
    const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    expect(dimensions.scroll, `${width}px storage feedback`).toBeLessThanOrEqual(dimensions.client + 1);
  }
});

test('theme changes synchronize across tabs without reload', async ({ context, page }) => {
  const second = await context.newPage();
  await Promise.all([page.goto(''), second.goto('progress')]);
  await page.getByLabel('Theme').selectOption('sakura');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'sakura');
  await expect(second.getByLabel('Theme')).toHaveValue('sakura');
  await second.close();
});

test('changing theme during practice preserves the active answer and session', async ({ page }) => {
  await page.goto('practice?level=L0&skill=abacus-orientation&start=1');
  const sessionId = await page.locator('#session-id').textContent();
  await page.locator('#answer-input').fill('42');
  await page.getByLabel('Theme').selectOption('sumi');
  await expect(page.getByLabel('Theme')).toBeFocused();
  await expect(page.locator('#answer-input')).toHaveValue('42');
  await expect(page.locator('#session-id')).toHaveText(sessionId);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sumi');
});

for (const theme of THEMES) {
  test(`${theme.label} applies across every distinct page template`, async ({ page }) => {
    await seedTheme(page, theme.id);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of representativeRoutes) {
      await page.goto(route);
      await expect(page.locator('html'), route).toHaveAttribute('data-theme', theme.id);
      await expect(page.getByLabel('Theme'), route).toHaveValue(theme.id);
      const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
      expect(dimensions.scroll, route).toBeLessThanOrEqual(dimensions.client + 1);
      if (theme.id === 'sumi') {
        const panelBackground = await page.locator('.panel').first().evaluate((node) => getComputedStyle(node).backgroundColor);
        expect(panelBackground, route).not.toBe('rgb(255, 255, 255)');
      }
    }
    expect(errors).toEqual([]);
  });
}

const concreteRoutes = builtRoutes();
for (let index = 0; index < concreteRoutes.length; index += 12) {
  const group = concreteRoutes.slice(index, index + 12);
  test(`built route group ${index / 12 + 1} loads without page errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const route of group) {
      await page.goto(route);
      await expect(page.locator('html'), route || 'home').toHaveAttribute('data-theme', 'washi');
    }
    expect(errors).toEqual([]);
  });
}

for (const themeId of themeIds) {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 361, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 861, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    test(`${themeId} header and selector fit at ${viewport.width}px`, async ({ page }) => {
      await seedTheme(page, themeId);
      await page.setViewportSize(viewport);
      await page.goto('');
      const header = page.locator('.site-header');
      const selector = page.getByLabel('Theme');
      const [headerBox, selectorBox, pickerBox] = await Promise.all([
        header.boundingBox(),
        selector.boundingBox(),
        page.locator('.theme-picker').boundingBox(),
      ]);
      expect(headerBox).not.toBeNull();
      expect(selectorBox).not.toBeNull();
      expect(pickerBox).not.toBeNull();
      expect(selectorBox.height).toBeGreaterThanOrEqual(44);
      expect(selectorBox.x).toBeGreaterThanOrEqual(0);
      expect(selectorBox.x + selectorBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(pickerBox.x).toBeGreaterThanOrEqual(0);
      expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(pickerBox.width).toBeLessThanOrEqual(180);
      expect(headerBox.height).toBeLessThanOrEqual(viewport.width <= 860 ? 190 : 120);
      await expect(header).toHaveCSS('position', viewport.width <= 860 ? 'static' : 'sticky');
      if (viewport.width <= 360) await expect(page.locator('.brand-mark')).toBeHidden();
      await expect(page.locator('.nav-primary')).toBeVisible();
      await expect(page.locator('.nav-more > summary')).toBeVisible();
    });
  }
}

for (const themeId of themeIds) {
  for (const width of [320, 390]) {
    test(`${themeId} high-risk routes stay responsive at ${width}px`, async ({ page }) => {
      await seedTheme(page, themeId);
      await page.setViewportSize({ width, height: 844 });
      for (const route of highRiskRoutes) {
        await page.goto(route);
        const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        expect(dimensions.scroll, route).toBeLessThanOrEqual(dimensions.client + 1);
        await expect(page.getByLabel('Theme')).toBeVisible();
      }
    });
  }
}

test('Sumi print output becomes neutral light paper', async ({ page }) => {
  await seedTheme(page, 'sumi');
  await page.goto('worksheets');
  const input = page.locator('.worksheet-input').first();
  await input.fill('42');
  await page.emulateMedia({ media: 'print' });
  const styles = await page.evaluate(() => ({
    scheme: getComputedStyle(document.documentElement).colorScheme,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    panelBackground: getComputedStyle(document.querySelector('.panel')).backgroundColor,
    inputBackground: getComputedStyle(document.querySelector('.worksheet-input')).backgroundColor,
    inputColor: getComputedStyle(document.querySelector('.worksheet-input')).color,
    accentColor: getComputedStyle(document.querySelector('.eyebrow')).color,
    headerDisplay: getComputedStyle(document.querySelector('.site-header')).display,
  }));
  expect(styles).toEqual({
    scheme: 'light',
    bodyBackground: 'rgb(255, 255, 255)',
    bodyColor: 'rgb(17, 17, 17)',
    panelBackground: 'rgb(255, 255, 255)',
    inputBackground: 'rgb(255, 255, 255)',
    inputColor: 'rgb(17, 17, 17)',
    accentColor: 'rgb(107, 29, 53)',
    headerDisplay: 'none',
  });
});
