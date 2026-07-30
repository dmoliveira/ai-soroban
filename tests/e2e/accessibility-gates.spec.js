import { expect, test } from '@playwright/test';

import { expectAccessibleState } from './accessibility.js';

const solvePracticePrompt = (prompt) => {
  const addMatch = prompt.match(/Start from (\d+)\. Add (\d+)\./);
  if (addMatch) return Number(addMatch[1]) + Number(addMatch[2]);
  const subtractMatch = prompt.match(/Start from (\d+)\. Subtract (\d+)\./);
  if (subtractMatch) return Number(subtractMatch[1]) - Number(subtractMatch[2]);
  throw new Error(`Unsupported practice prompt: ${prompt}`);
};

const inputAt = (page, index) => page.locator('.worksheet-input').nth(index);
const rowFor = (input) => input.locator('xpath=ancestor::*[contains(@class,"worksheet-row") or contains(@class,"vertical-drill-row")]');

test('Practice active, recovery, reveal, and completion states pass WCAG A/AA scans', async ({ page }, testInfo) => {
  await page.goto('practice');
  await page.getByText('Adjust session setup').click();
  await page.selectOption('#session-format', 'single');
  await page.selectOption('#session-type', 'generated');
  await page.selectOption('#session-level', 'L1');
  await page.selectOption('#session-length', '5');
  await page.selectOption('#check-mode', 'final');
  await page.getByRole('button', { name: 'Start new session' }).click();

  await expect(page.locator('#single-session-active')).toBeVisible();
  await expect(page.locator('#answer-input')).toBeFocused();
  await expectAccessibleState(page, testInfo, 'Practice active question');

  const prompt = (await page.locator('#question-prompt').textContent()) || '';
  await page.locator('#answer-input').fill(String(solvePracticePrompt(prompt) + 1));
  await page.locator('#verify-answer').click();
  await expect(page.locator('#feedback-panel')).toContainText('First check missed');
  await expect(page.locator('#recovery-panel')).toBeVisible();
  await expectAccessibleState(page, testInfo, 'Practice error and recovery');

  await page.locator('#reveal-steps').click();
  await expect(page.locator('#steps-panel')).toBeVisible();
  await expect(page.locator('#feedback-panel')).toContainText('The answer is');
  await expectAccessibleState(page, testInfo, 'Practice revealed method');

  for (let index = 0; index < 4; index += 1) {
    await page.locator('#next-question').click();
    await expect(page.locator('#session-progress')).toHaveText(`Question ${index + 2} / 5`);
  }
  await expect(page.locator('#next-question')).toBeEnabled();
  await page.locator('#next-question').click();
  await expect(page.locator('#session-complete-actions')).toBeVisible();
  await expect(page.locator('#feedback-panel')).toBeFocused();
  await expectAccessibleState(page, testInfo, 'Practice completed session');
});

test('Worksheet interactive, error, reveal, and answer-key states pass WCAG A/AA scans', async ({ page }, testInfo) => {
  await page.goto('worksheets?preset=complements');

  await expect(page.locator('.worksheet-input')).toHaveCount(40);
  await expect(inputAt(page, 0)).toBeVisible();
  await expectAccessibleState(page, testInfo, 'Worksheet interactive sheet');

  const first = inputAt(page, 0);
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('write your answer first');
  await expectAccessibleState(page, testInfo, 'Worksheet blank-row error');

  const second = inputAt(page, 1);
  await rowFor(second).getByRole('button', { name: 'Reveal answer for worksheet question 2', exact: true }).click();
  await expect(rowFor(second).locator('.worksheet-feedback')).toContainText('Answer revealed:');
  await expectAccessibleState(page, testInfo, 'Worksheet revealed row');

  await page.getByText('After you generate').click();
  await page.getByRole('button', { name: 'Open teacher answer key' }).click();
  await expect(page.locator('#worksheet-style')).toHaveValue('teacher');
  await expect(page.locator('#worksheet-print-mode')).toHaveValue('answer-key');
  await expect(page.locator('.worksheet-feedback')).toHaveCount(40);
  await expect(page.locator('#worksheet-save-status')).toContainText('Teacher answer key opened for 40 rows');
  await expectAccessibleState(page, testInfo, 'Worksheet teacher answer key');
});

test('Daily drill generated and revealed states pass WCAG A/AA scans', async ({ page }, testInfo) => {
  await page.goto('daily-drills');

  await expect(page.locator('.daily-reveal-answer')).toHaveCount(8);
  await expect(page.locator('#daily-generate-status')).toContainText('Generated 8');
  await expectAccessibleState(page, testInfo, 'Daily drill generated pack');

  const revealAll = page.getByRole('button', { name: 'Reveal answers' });
  await revealAll.focus();
  await revealAll.press('Space');
  await expect(revealAll).toBeFocused();
  await expect(page.locator('.daily-answer:not([hidden])')).toHaveCount(8);
  await expect(page.locator('.daily-reveal-answer[aria-expanded="true"]')).toHaveCount(8);
  await expect(page.locator('#daily-generate-status')).toHaveText('All 8 answers revealed.');
  await expectAccessibleState(page, testInfo, 'Daily drill revealed answers');
});

test('Mini-game configuration, running, answer, builder, and result states pass WCAG A/AA scans', async ({ page }, testInfo) => {
  await page.goto('mini-games');
  await page.getByRole('button', { name: 'Configure Flash Anzan' }).click();

  await expect(page.locator('#mini-game-title')).toHaveText('Flash Anzan');
  await expect(page.locator('#mini-game-title')).toBeFocused();
  await expect(page.locator('#mini-game-accessibility-note')).toBeVisible();
  await expectAccessibleState(page, testInfo, 'Flash Anzan configuration');

  await page.locator('#mini-game-term-count').selectOption('10');
  await page.locator('#mini-game-term-interval').selectOption('500');
  await page.locator('#mini-game-start-selected').click();
  await expect(page.locator('#mini-game-term-counter')).toHaveText('Term 1 / 10');
  await expect(page.locator('#mini-game-answer')).toBeDisabled();
  await expectAccessibleState(page, testInfo, 'Flash Anzan running sequence');

  await expect(page.locator('#mini-game-prompt-title')).toHaveText('Final total', { timeout: 8_000 });
  await expect(page.locator('#mini-game-answer')).toBeEnabled();
  await expect(page.locator('#mini-game-answer')).toBeFocused();
  await expectAccessibleState(page, testInfo, 'Flash Anzan awaiting answer');

  await page.locator('#mini-game-answer').fill('0');
  await page.locator('#mini-game-check').click();
  await expect(page.locator('#mini-game-results')).toBeVisible();
  await expect(page.locator('#mini-game-result-title')).toBeFocused();
  await expectAccessibleState(page, testInfo, 'Flash Anzan result');

  await page.getByRole('button', { name: 'Configure Bead Builder' }).click();
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-start-selected').click();
  await expect(page.locator('#mini-game-bead-builder')).toBeVisible();
  await expect(page.locator('#mini-game-numeric-answer')).toBeHidden();
  await expect(page.locator('#mini-builder-upper')).toBeFocused();
  await page.locator('#mini-builder-upper').press('Space');
  await expect(page.locator('#mini-builder-status')).toContainText('Current rod value: 5');
  await expectAccessibleState(page, testInfo, 'Bead Builder active controls');
});

test('Populated expanded Progress passes a WCAG A/AA scan', async ({ page }, testInfo) => {
  await page.goto('worksheets?preset=complements');
  const first = inputAt(page, 0);
  await first.fill((await first.getAttribute('data-answer')) || '');
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/1 unassisted first checks correct');

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('.progress-more')).toHaveAttribute('open', '');
  await expect(page.locator('#skill-map .skill-row').filter({ hasText: 'complements' })).toContainText('1/5 samples');
  await expect(page.locator('#worksheet-focus-map .skill-row').filter({ hasText: 'complement balance' })).toContainText('best checked result 100%');
  await expectAccessibleState(page, testInfo, 'Progress populated disclosure');
});
