import { expect, test } from '@playwright/test';

test('mini games can start and score complement dash', async ({ page }) => {
  await page.goto('/ai-soroban/mini-games');

  await page.getByRole('button', { name: 'Start now' }).first().click();
  await expect(page.locator('#mini-game-title')).toContainText('Complement dash');
  await expect(page.locator('#mini-game-round')).toContainText('1');

  const prompt = await page.locator('#mini-game-prompt').textContent();
  const match = prompt?.match(/What completes (\d+) to (\d+)\?/);
  const answer = match ? Number(match[2]) - Number(match[1]) : null;
  await page.locator('#mini-game-answer').fill(String(answer));
  await page.locator('#mini-game-answer').press('Enter');

  await expect(page.locator('#mini-game-score')).not.toContainText('0');
});

test('boss rounds page exposes level milestone actions', async ({ page }) => {
  await page.goto('/ai-soroban/boss-rounds');

  const bossCard = page.locator('article').filter({ hasText: 'Product and quotient boss' }).first();
  await expect(bossCard).toBeVisible();
  await expect(bossCard.getByRole('link', { name: 'Worksheet' })).toHaveAttribute('href', /division-focus/);
});
