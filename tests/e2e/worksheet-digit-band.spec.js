import { expect, test } from '@playwright/test';

test('3-4 digit sequence worksheet keeps every rendered operand in band', async ({ page }) => {
  await page.goto('/ai-soroban/worksheets');

  await page.getByRole('button', { name: 'Sequence mix' }).click();
  await page.selectOption('#worksheet-band', '3-4');
  await page.getByRole('button', { name: 'Generate ledger' }).click();

  await expect(page.locator('#worksheet-title')).toContainText('3-4 digits');
  await expect(page.locator('.vertical-drill-row').first()).toBeVisible();

  const values = await page.locator('.vertical-drill-row .v-arith-value').allTextContents();
  expect(values.length).toBeGreaterThan(0);

  values.forEach((value) => {
    const digitsOnly = value.trim().replace(/\D/g, '');
    expect(digitsOnly.length).toBeGreaterThanOrEqual(3);
    expect(digitsOnly.length).toBeLessThanOrEqual(4);
  });
});
