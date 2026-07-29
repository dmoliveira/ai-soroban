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

test('learner route persists as legacy-compatible raw state and clears independently', async ({ page }) => {
  const placement = JSON.stringify({
    choice: { level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' },
    answers: {},
  });
  await page.addInitScript((savedPlacement) => {
    if (!localStorage.getItem('soroban-dojo:placement-result')) {
      localStorage.setItem('soroban-dojo:placement-result', savedPlacement);
    }
  }, placement);
  await page.goto('');

  const children = page.getByRole('button', { name: 'Use children route' });
  await children.click();
  await expect(children).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('Children route saved');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');

  await page.reload();
  await expect(page.locator('[data-learner-path-current]')).toContainText('Current route: Children');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');

  await page.goto('paths/adults');
  const adults = page.getByRole('button', { name: 'Use adults route' });
  await adults.focus();
  await page.keyboard.press('Enter');
  await expect(adults).toBeFocused();
  await expect(page.locator('[data-learner-path-current]')).toContainText('Current route: Adults');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('adults');

  await page.getByRole('button', { name: 'Clear saved route' }).click();
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('Other progress is unchanged');
  expect(await page.evaluate(() => ({
    path: localStorage.getItem('soroban-dojo:path'),
    placement: localStorage.getItem('soroban-dojo:placement-result'),
  }))).toEqual({ path: null, placement });
});

test('learner route controls report blocked writes and clears without changing saved state', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('soroban-dojo:path', 'children'));
  await page.goto('');
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:path') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function removeItem(key) {
      if (key === 'soroban-dojo:path') throw new DOMException('blocked', 'SecurityError');
      return nativeRemoveItem.call(this, key);
    };
  });

  await page.getByRole('button', { name: 'Use adults route' }).click();
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('Children remains active');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');

  await page.getByRole('button', { name: 'Clear saved route' }).click();
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('could not be cleared');
  await expect(page.locator('[data-learner-path-current]')).toContainText('Current route: Children');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');
});

test('placement answers and recommendation survive repeated reloads', async ({ page }) => {
  await page.goto('assessments');

  const groups = page.locator('#placement-questions fieldset');
  await expect(groups).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    await groups.nth(index).locator('label').last().click();
  }
  await page.getByRole('button', { name: 'Get my recommendation' }).click();
  await expect(page.locator('#placement-result')).toContainText('Recommended start: L4');
  await expect(page.locator('#placement-save-status')).toContainText('L4 Advanced starting point saved');

  await page.reload();
  await page.reload();

  await expect(page.locator('#placement-result')).toContainText('Recommended start: L4');
  await expect(groups.first().getByRole('radio').last()).toBeChecked();
  await expect(page.getByRole('button', { name: 'Get my recommendation' })).toBeEnabled();
});

test('placement starting point clears separately from answers and full reset stays explicit', async ({ page }) => {
  await page.goto('assessments');
  const groups = page.locator('#placement-questions fieldset');
  for (let index = 0; index < 6; index += 1) await groups.nth(index).locator('label').last().click();
  await page.getByRole('button', { name: 'Get my recommendation' }).click();

  await page.getByRole('button', { name: 'Clear saved starting point' }).click();
  await expect(page.locator('#placement-result')).toBeHidden();
  await expect(page.locator('#placement-save-status')).toContainText('selected answers are still available');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:placement-result')))).toEqual({
    choice: null,
    answers: {
      q1: 'q1-yes',
      q2: 'q2-yes',
      q3: 'q3-comfortably',
      q4: 'q4-yes',
      q5: 'q5-yes',
      q6: 'q6-yes',
    },
  });

  await page.getByRole('button', { name: 'Get my recommendation' }).click();
  await page.getByRole('button', { name: 'Clear recommendation and answers' }).click();
  await expect(page.locator('#placement-save-status')).toContainText('Other progress is unchanged');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBeNull();
  await expect(groups.first().getByRole('radio').last()).not.toBeChecked();
});

test('a failed placement score never piggybacks onto a later answer save', async ({ page }) => {
  await page.goto('assessments');
  const groups = page.locator('#placement-questions fieldset');
  for (let index = 0; index < 6; index += 1) await groups.nth(index).locator('label').last().click();
  await page.evaluate(() => {
    window.__placementNativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:placement-result') throw new DOMException('blocked', 'QuotaExceededError');
      return window.__placementNativeSetItem.call(this, key, value);
    };
  });

  await page.getByRole('button', { name: 'Get my recommendation' }).click();
  await expect(page.locator('#placement-save-status')).toContainText('could not be saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:placement-result'))?.choice)).toBeNull();

  await groups.first().locator('label').first().click();
  await expect(page.locator('#placement-result')).toBeHidden();
  await expect(page.locator('#placement-save-status')).toContainText('Score again when the answers are ready');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:placement-result'))?.choice)).toBeNull();

  await page.evaluate(() => { Storage.prototype.setItem = window.__placementNativeSetItem; });
  await groups.nth(1).locator('label').first().click();
  await expect(page.locator('#placement-result')).toBeHidden();
  await expect(page.locator('#placement-save-status')).toContainText('Answer saved in this browser');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:placement-result'))?.choice)).toBeNull();
});

test('legacy placement recommendation remains readable', async ({ page }) => {
  const legacy = JSON.stringify({
    level: 'L2',
    title: 'Basic Operations',
    reason: 'Strengthen complements before mixed work.',
  });
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:placement-result', JSON.stringify({
      level: 'L2',
      title: 'Basic Operations',
      reason: 'Strengthen complements before mixed work.',
    }));
  });

  await page.goto('assessments');

  await expect(page.locator('#placement-result')).toContainText('Recommended start: L2');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBe(legacy);
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBe(legacy);
});

test('future learner context stays byte-identical and read-only', async ({ page }) => {
  const placement = JSON.stringify({
    choice: { level: 'L3', title: 'Intermediate', reason: 'Continue mixed-operation fluency.' },
    answers: { q1: 'q1-yes' },
  });
  await page.addInitScript((savedPlacement) => {
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 99 }));
    localStorage.setItem('soroban-dojo:path', 'children');
    localStorage.setItem('soroban-dojo:placement-result', savedPlacement);
  }, placement);

  await page.goto('');
  await expect(page.locator('[data-learner-path-current]')).toContainText('Current route: Children');
  await expect(page.getByRole('button', { name: 'Use adults route' })).toBeDisabled();
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('read-only');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');

  await page.goto('assessments');
  await expect(page.locator('#placement-result')).toContainText('Recommended start: L3');
  await expect(page.getByRole('button', { name: 'Clear saved starting point' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear recommendation and answers' })).toBeDisabled();
  await page.locator('#placement-questions fieldset').first().locator('label').first().click();
  await expect(page.locator('#placement-save-status')).toContainText('saved starting point remains active');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBe(placement);
});

test('placement clear failures preserve the visible and stored recommendation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:placement-result', JSON.stringify({
      choice: { level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' },
      answers: {},
    }));
  });
  await page.goto('assessments');
  const before = await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'));
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:placement-result') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
    Storage.prototype.removeItem = function removeItem(key) {
      if (key === 'soroban-dojo:placement-result') throw new DOMException('blocked', 'SecurityError');
      return nativeRemoveItem.call(this, key);
    };
  });

  await page.getByRole('button', { name: 'Clear saved starting point' }).click();
  await expect(page.locator('#placement-result')).toContainText('Recommended start: L2');
  await expect(page.locator('#placement-save-status')).toContainText('current recommendation remains active');
  await page.getByRole('button', { name: 'Clear recommendation and answers' }).click();
  await expect(page.locator('#placement-result')).toContainText('Recommended start: L2');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBe(before);
});

test('learner route and placement context refresh in another open tab', async ({ page, context }) => {
  const sibling = await context.newPage();
  await page.goto('');
  await sibling.goto('');

  await page.getByRole('button', { name: 'Use children route' }).click();
  await expect(sibling.locator('[data-learner-path-current]')).toContainText('Current route: Children');
  await expect(sibling.locator('[data-learner-path-feedback]')).toContainText('another open Dojo tab');

  await page.goto('assessments');
  await sibling.goto('assessments');
  const groups = page.locator('#placement-questions fieldset');
  for (let index = 0; index < 6; index += 1) await groups.nth(index).locator('label').last().click();
  await page.getByRole('button', { name: 'Get my recommendation' }).click();

  await expect(sibling.locator('#placement-result')).toContainText('Recommended start: L4');
  await expect(sibling.locator('#placement-save-status')).toContainText('another open Dojo tab');

  await page.getByRole('button', { name: 'Clear saved starting point' }).click();
  await expect(sibling.locator('#placement-result')).toBeHidden();
  await sibling.close();
});

test('open tabs become read-only when another tab introduces a future schema', async ({ page, context }) => {
  const writer = await context.newPage();
  const assessment = await context.newPage();
  const placement = JSON.stringify({
    choice: { level: 'L2', title: 'Basic Operations', reason: 'Keep strengthening complements.' },
    answers: {},
  });
  await writer.goto('');
  await writer.evaluate((savedPlacement) => {
    localStorage.setItem('soroban-dojo:path', 'children');
    localStorage.setItem('soroban-dojo:placement-result', savedPlacement);
  }, placement);
  await page.goto('');
  await assessment.goto('assessments');
  await expect(page.getByRole('button', { name: 'Use adults route' })).toBeEnabled();
  await expect(assessment.getByRole('button', { name: 'Clear saved starting point' })).toBeEnabled();

  await page.evaluate(() => {
    window.__schemaEventPath = null;
    const onStorage = (event) => {
      if (event.key !== 'soroban-dojo:state-schema') return;
      window.removeEventListener('storage', onStorage);
      document.querySelector('[data-learner-path-choice="adults"]')?.click();
      window.__schemaEventPath = localStorage.getItem('soroban-dojo:path');
    };
    window.addEventListener('storage', onStorage);
  });
  await writer.evaluate(() => {
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 99 }));
  });

  await expect.poll(() => page.evaluate(() => window.__schemaEventPath)).toBe('children');
  await expect(page.getByRole('button', { name: 'Use adults route' })).toBeDisabled();
  await expect(page.locator('[data-learner-path-feedback]')).toContainText('read-only');
  await expect(assessment.getByRole('button', { name: 'Clear saved starting point' })).toBeDisabled();
  await expect(assessment.getByRole('button', { name: 'Clear recommendation and answers' })).toBeDisabled();
  await expect(assessment.locator('#placement-save-status')).toContainText('read-only');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:path'))).toBe('children');
  expect(await assessment.evaluate(() => localStorage.getItem('soroban-dojo:placement-result'))).toBe(placement);
  await writer.close();
  await assessment.close();
});

test('a malformed companion locks another tab before its next write', async ({ page, context }) => {
  const writer = await context.newPage();
  await writer.goto('');
  await writer.evaluate(() => localStorage.setItem('soroban-dojo:path', 'children'));
  await page.goto('');
  await expect(page.getByRole('button', { name: 'Use adults route' })).toBeEnabled();

  await page.evaluate(() => {
    window.__companionEventPath = null;
    const onStorage = (event) => {
      if (event.key !== 'soroban-dojo:mastery-evidence-v1') return;
      window.removeEventListener('storage', onStorage);
      document.querySelector('[data-learner-path-choice="adults"]')?.click();
      window.__companionEventPath = localStorage.getItem('soroban-dojo:path');
    };
    window.addEventListener('storage', onStorage);
  });
  await writer.evaluate(() => {
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', '"malformed"');
  });

  await expect.poll(() => page.evaluate(() => window.__companionEventPath)).toBe('children');
  await expect(page.getByRole('button', { name: 'Use adults route' })).toBeDisabled();
  await expect(page.locator('#storage-compatibility-notice')).toContainText('protected and read-only');
  await writer.close();
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
