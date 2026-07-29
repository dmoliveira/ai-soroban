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
