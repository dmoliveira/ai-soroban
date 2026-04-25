import { expect, test } from '@playwright/test';

test('daily drills adapt to unfinished weekly plan step and weak area', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      a: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
      b: { status: 'needs-review', level: 'L4', skill: 'division', sessionId: 'exercise:L4:division' },
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      target: 'division',
      title: 'Division quotient week',
      lesson: { id: 'lesson-l4-006', done: true },
      exercise: { id: 'exercise-l4-007', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=division-focus&submode=quotient-building', done: false },
    }));
  });

  await page.goto('daily-drills');
  await page.selectOption('#daily-level', 'L4');
  await page.getByRole('button', { name: 'Generate pack' }).click();

  await expect(page.locator('#daily-drill-focus')).toContainText('division');
  await expect(page.locator('#daily-drill-focus')).toContainText('exercise');
  await expect(page.locator('#daily-guidance-title')).toContainText(/Division quotient today|Division factor search today/);
  await expect(page.locator('#daily-link-worksheet')).toHaveAttribute('href', /submode=quotient-building/);
  await expect(page.locator('#daily-drill-list')).toContainText(/÷|factor/);
});
