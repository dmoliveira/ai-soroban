import { expect, test } from '@playwright/test';

const releaseRoutes = ['', 'privacy', 'releases', 'practice', 'worksheets'];

test('release routes load from the configured Soroban Dojo base path', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const route of releaseRoutes) {
    const response = await page.goto(route);
    expect(response?.ok(), `${route || 'home'} response`).toBe(true);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByLabel('Theme')).toBeVisible();
    expect(new URL(page.url()).pathname).toMatch(/^\/soroban-dojo\/(?:.*)?$/);
  }

  expect(errors).toEqual([]);
});

test('release page publishes the complete 0.4 learner contract', async ({ page }) => {
  await page.goto('releases');
  const latest = page.locator('.release-feature-card');

  await expect(latest.getByText('Latest update · Version 0.4.0')).toBeVisible();
  await expect(latest.getByRole('heading', { level: 2, name: 'Verified evidence and practice-first flow' })).toBeVisible();
  await expect(latest.getByText(/prospective first-check evidence/i).first()).toBeVisible();
  await expect(latest.getByText(/Ten Bridge as a deterministic certified challenge/i)).toBeVisible();
  await expect(latest.getByText(/Bead Builder as an accessible canonical one-rod mini-game/i)).toBeVisible();
  await expect(latest.getByRole('link', { name: 'Start focused practice' })).toBeVisible();
  await expect(latest.getByRole('link', { name: 'Open certified worksheets' })).toBeVisible();
});

test('privacy page discloses prospective evidence and read-only compatibility', async ({ page }) => {
  await page.goto('privacy');

  await expect(page.getByRole('heading', { level: 1, name: 'Your progress stays in your browser' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Older activity stays visible without becoming verified mastery' })).toBeVisible();
  await expect(page.getByText(/does not upgrade it into verified mastery/i)).toBeVisible();
  await expect(page.getByText(/versioned evidence, score, or provenance record cannot be validated/i)).toBeVisible();
  await expect(page.getByText(/Other malformed local records use safe read-time fallbacks/i)).toBeVisible();
  await expect(page.getByText(/No account, hidden analytics, or remote progress service is required/i)).toBeVisible();
});

test('deployed worksheet evidence separates first checks from corrected activity', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const inputs = page.locator('.worksheet-input');
  const first = inputs.nth(0);
  const second = inputs.nth(1);
  const firstAnswer = Number(await first.getAttribute('data-answer'));
  const secondAnswer = Number(await second.getAttribute('data-answer'));
  const firstItemId = await first.getAttribute('data-question-id');
  const secondItemId = await second.getAttribute('data-question-id');
  const firstRow = first.locator('xpath=ancestor::*[contains(@class,"worksheet-row") or contains(@class,"vertical-drill-row")]');
  const secondRow = second.locator('xpath=ancestor::*[contains(@class,"worksheet-row") or contains(@class,"vertical-drill-row")]');

  await first.fill(String(firstAnswer));
  await firstRow.getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await second.fill(String(secondAnswer + 1));
  await secondRow.getByRole('button', { name: 'Check worksheet question 2', exact: true }).click();
  await second.fill(String(secondAnswer));
  await secondRow.getByRole('button', { name: 'Check worksheet question 2', exact: true }).click();

  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/2 unassisted first checks correct');
  await expect(page.locator('#worksheet-score-copy')).toContainText('2/2 correct now');
  const saved = await page.evaluate(() => ({
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
    seen: JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || '{"version":1,"claims":[]}'),
    worksheets: JSON.parse(localStorage.getItem('soroban-dojo:worksheet-sessions') || '[]'),
  }));
  expect(saved.evidence).toHaveLength(2);
  expect(saved.seen.claims).toHaveLength(2);
  expect(saved.evidence.every((attempt) => attempt.eligibility === 'prospective'
    && saved.seen.claims.some((claim) => claim.itemId === attempt.itemId && claim.attemptId === attempt.attemptId))).toBe(true);
  const firstCheck = saved.evidence.find((attempt) => attempt.itemId === firstItemId);
  const corrected = saved.evidence.find((attempt) => attempt.itemId === secondItemId);
  expect(firstCheck.events.map((event) => [event.kind, event.correct])).toEqual([['submit', true]]);
  expect(corrected.events.map((event) => [event.kind, event.correct])).toEqual([['submit', false], ['submit', true]]);
  expect(saved.seen.claims.filter((claim) => claim.itemId === firstItemId && claim.attemptId === firstCheck.attemptId)).toHaveLength(1);
  expect(saved.seen.claims.filter((claim) => claim.itemId === secondItemId && claim.attemptId === corrected.attemptId)).toHaveLength(1);
  expect(saved.worksheets[0]).toMatchObject({ answered: 2, correct: 2, accuracy: 100, submode: 'complement-balance' });

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#skill-map .skill-row').filter({ hasText: 'complements' })).toContainText('2/5 samples · 1 first-check correct');
  await expect(page.locator('#worksheet-focus-map .skill-row').filter({ hasText: 'complement balance' })).toContainText('best checked result 100% · corrections included');
});
