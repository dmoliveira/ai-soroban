import { expect, test } from '@playwright/test';

const progressKeys = [
  'soroban-dojo:path',
  'soroban-dojo:completed-lessons',
  'soroban-dojo:exercise-states',
  'soroban-dojo:timer-history',
  'soroban-dojo:practice-sessions',
  'soroban-dojo:worksheet-sessions',
  'soroban-dojo:weekly-study-plan',
  'soroban-dojo:placement-result',
  'soroban-dojo:minigame-scores',
  'soroban-dojo:minigame-medals',
  'soroban-dojo:boss-rounds',
  'soroban-dojo:boss-session-progress',
  'soroban-dojo:boss-certificates',
  'soroban-dojo:mastery-evidence-v1',
  'soroban-dojo:mastery-seen-items-v1',
  'soroban-dojo:minigame-scores-v2',
  'soroban-dojo:boss-provenance-v1',
];

test('placement answers and recommendation survive repeated reloads', async ({ page }) => {
  await page.goto('assessments');

  const groups = page.locator('#placement-questions fieldset');
  await expect(groups).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await groups.nth(index).locator('label').last().click();
  }
  await page.getByRole('button', { name: 'Get my recommendation' }).click();
  await expect(page.locator('#placement-result')).toContainText('Recommended start: L4');

  await page.reload();
  await page.reload();

  await expect(page.locator('#placement-result')).toContainText('Recommended start: L4');
  await expect(groups.first().getByRole('radio').last()).toBeChecked();
  await expect(page.getByRole('button', { name: 'Get my recommendation' })).toBeEnabled();
});

test('legacy placement recommendation remains readable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:placement-result', JSON.stringify({
      level: 'L2',
      title: 'Basic Operations',
      reason: 'Strengthen complements before mixed work.',
    }));
  });

  await page.goto('assessments');

  await expect(page.locator('#placement-result')).toContainText('Recommended start: L2');
});

test('progress reset clears every learning key and preserves preferences', async ({ page }) => {
  await page.goto('progress');
  await page.evaluate((keys) => {
    keys.forEach((key) => localStorage.setItem(key, JSON.stringify({ saved: true })));
    localStorage.setItem('soroban-dojo:theme', 'sakura');
    localStorage.setItem('unrelated:key', 'keep');
  }, progressKeys);
  page.once('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: 'Reset progress' }).click();
  await page.waitForLoadState('domcontentloaded');

  const remaining = await page.evaluate((keys) => ({
    progress: keys.filter((key) => localStorage.getItem(key) !== null),
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || 'null'),
    seenItems: JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || 'null'),
    scores: JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores-v2') || 'null'),
    provenance: JSON.parse(localStorage.getItem('soroban-dojo:boss-provenance-v1') || 'null'),
    theme: localStorage.getItem('soroban-dojo:theme'),
    unrelated: localStorage.getItem('unrelated:key'),
  }), progressKeys);
  expect(remaining.progress).toEqual([
    'soroban-dojo:mastery-evidence-v1',
    'soroban-dojo:mastery-seen-items-v1',
    'soroban-dojo:minigame-scores-v2',
    'soroban-dojo:boss-provenance-v1',
  ]);
  expect(remaining.evidence).toEqual([]);
  expect(remaining.seenItems).toEqual({ version: 1, claims: [] });
  expect(remaining.scores).toEqual({ version: 2, legacy: { scores: {}, medals: {} }, bestByScope: {} });
  expect(remaining.provenance).toEqual({});
  expect(remaining.theme).toBe('sakura');
  expect(remaining.unrelated).toBe('keep');
});

test('progress reset reloads another open Dojo tab', async ({ page, context }) => {
  const sibling = await context.newPage();
  await sibling.addInitScript(() => {
    const loads = Number(sessionStorage.getItem('reset-test-loads') || 0) + 1;
    sessionStorage.setItem('reset-test-loads', String(loads));
  });
  await page.goto('progress');
  await sibling.goto('practice');
  await page.evaluate(() => localStorage.setItem('soroban-dojo:completed-lessons', JSON.stringify(['lesson-l0-001'])));
  const loadsBeforeReset = await sibling.evaluate(() => Number(sessionStorage.getItem('reset-test-loads')));
  page.once('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: 'Reset progress' }).click();

  await expect.poll(() => sibling.evaluate(() => Number(sessionStorage.getItem('reset-test-loads')))).toBeGreaterThan(loadsBeforeReset);
  expect(await sibling.evaluate(() => localStorage.getItem('soroban-dojo:completed-lessons'))).toBeNull();
  await sibling.close();
});

test('progress reset warns when no cross-tab notification transport succeeds', async ({ page }) => {
  await page.goto('progress');
  await page.evaluate(() => {
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:reset-epoch') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
    localStorage.setItem('soroban-dojo:completed-lessons', JSON.stringify(['lesson-l0-001']));
  });
  page.once('dialog', (dialog) => dialog.accept());

  await page.getByRole('button', { name: 'Reset progress' }).click();

  await expect(page.locator('#storage-compatibility-notice')).toContainText('reload them before continuing');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:completed-lessons'))).toBeNull();
});

test('completed weekly plan is not reported as an unfinished lesson', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      planId: 'arithmetic',
      target: 'arithmetic',
      lesson: { done: true },
      exercise: { done: true },
      worksheet: { done: true },
    }));
  });

  await page.goto('daily-drills');

  await expect(page.locator('#daily-drill-focus')).toContainText('Weekly plan complete');
  await expect(page.locator('#daily-guidance-primary-copy')).toContainText('optional review');
  await expect(page.locator('#daily-link-primary')).toContainText('optional exercise review');
});

test('checked practice sheets record every result for adaptive review', async ({ page }) => {
  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-format', 'sheet');
  await page.selectOption('#session-type', 'generated');
  await page.selectOption('#session-level', 'L3');
  await page.selectOption('#session-length', '5');
  await page.getByRole('button', { name: 'Start new session' }).click();

  const inputs = page.locator('#sheet-list .input');
  await expect(inputs).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) await inputs.nth(index).fill('999999');
  await page.getByRole('button', { name: 'Check sheet' }).click();

  const states = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:exercise-states') || '{}'));
  expect(Object.keys(states)).toHaveLength(5);
  expect(Object.values(states).every((entry) => entry.status === 'needs-review' && entry.level === 'L3')).toBe(true);
});

test('critical routes load without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of ['', 'practice', 'assessments', 'study-plan', 'daily-drills', 'progress']) {
    await page.goto(route);
  }

  expect(errors).toEqual([]);
});
