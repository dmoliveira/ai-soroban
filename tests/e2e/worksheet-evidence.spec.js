import { expect, test } from '@playwright/test';

const inputAt = (page, index) => page.locator('.worksheet-input').nth(index);
const rowFor = (input) => input.locator('xpath=ancestor::*[contains(@class,"worksheet-row") or contains(@class,"vertical-drill-row")]');

test('worksheet prompts and row actions use one atomic status', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const first = inputAt(page, 0);
  const promptId = await first.getAttribute('aria-describedby');
  expect(promptId).toBe('worksheet-prompt-1');
  await expect(page.locator(`#${promptId}`)).toHaveText((await first.getAttribute('data-prompt')) || '');
  await expect(page.locator('.worksheet-feedback[aria-live]')).toHaveCount(0);

  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-save-status')).toHaveText('Question 1: write your answer first. No worksheet evidence was recorded.');

  await rowFor(first).getByRole('button', { name: 'Reveal answer for worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('Question 1: Answer revealed:');
  await expect(page.locator('#worksheet-save-status')).toContainText('First-check evidence: no unassisted first checks saved');
  await expect(page.locator('#worksheet-save-status')).toContainText('Worksheet activity and evidence history saved');
  const statusBeforeRerender = await page.locator('#worksheet-save-status').textContent();
  const feedbackBeforeRerender = await rowFor(first).locator('.worksheet-feedback').textContent();

  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-orientation', 'vertical');
  const verticalPromptId = await inputAt(page, 0).getAttribute('aria-describedby');
  expect(verticalPromptId).toBe('worksheet-prompt-1');
  await expect(page.locator(`#${verticalPromptId}`)).toHaveClass(/v-arith-block/);
  await expect(page.locator('.worksheet-feedback[aria-live]')).toHaveCount(0);
  await expect(page.locator('#worksheet-save-status')).toHaveText(statusBeforeRerender || '');
  await expect(rowFor(inputAt(page, 0)).locator('.worksheet-feedback')).toHaveText(feedbackBeforeRerender || '');
});

test('worksheet bulk actions announce one mixed, blank, or maximum-size summary', async ({ page }) => {
  await page.goto('worksheets?preset=complements');
  await page.getByText('After you generate').click();

  const first = inputAt(page, 0);
  const second = inputAt(page, 1);
  await first.fill((await first.getAttribute('data-answer')) || '');
  await second.fill(String(Number(await second.getAttribute('data-answer')) + 1));
  await page.getByRole('button', { name: 'Check filled rows' }).click();

  await expect(page.locator('#worksheet-save-status')).toContainText('Checked 2 filled rows.');
  await expect(page.locator('#worksheet-save-status')).toContainText('Current checked result: 1 of 2 correct now.');
  await expect(page.locator('#worksheet-save-status')).toContainText('First-check evidence: 1 of 2 unassisted first checks correct.');
  await expect(page.locator('#worksheet-save-status')).toContainText('Worksheet activity and evidence history saved');

  await page.getByRole('button', { name: 'Refresh questions' }).click();
  await page.getByRole('button', { name: 'Check filled rows' }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('No filled rows checked. Blank rows were skipped.');
  await expect(page.locator('#worksheet-save-status')).toContainText('First-check evidence: no unassisted first checks saved');

  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-count', '100');
  await expect(page.locator('.worksheet-input')).toHaveCount(100);
  await page.getByRole('button', { name: 'Check filled rows' }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('No filled rows checked. Blank rows were skipped.');
  await expect(page.locator('.worksheet-feedback[aria-live]')).toHaveCount(0);
});

test('worksheet first checks remain separate from corrected checked activity', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const inputs = page.locator('.worksheet-input');
  const answers = await inputs.evaluateAll((nodes) => nodes.slice(0, 4).map((node) => Number(node.getAttribute('data-answer'))));

  await rowFor(inputAt(page, 0)).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(rowFor(inputAt(page, 0)).locator('.worksheet-feedback')).toHaveText('Write first');

  await rowFor(inputAt(page, 1)).getByRole('button', { name: 'Reveal answer for worksheet question 2', exact: true }).click();
  await expect(rowFor(inputAt(page, 1)).locator('.worksheet-feedback')).toHaveText(`Answer revealed: ${answers[1]}`);

  await inputAt(page, 2).fill(String(answers[2]));
  await rowFor(inputAt(page, 2)).getByRole('button', { name: 'Check worksheet question 3', exact: true }).click();
  await expect(rowFor(inputAt(page, 2)).locator('.worksheet-feedback')).toHaveText('Correct on first check');

  await inputAt(page, 3).fill(String(answers[3] + 1));
  await rowFor(inputAt(page, 3)).getByRole('button', { name: 'Check worksheet question 4', exact: true }).click();
  await expect(rowFor(inputAt(page, 3)).locator('.worksheet-feedback')).toHaveText('Not correct yet');
  await inputAt(page, 3).fill(String(answers[3]));
  await rowFor(inputAt(page, 3)).getByRole('button', { name: 'Check worksheet question 4', exact: true }).click();
  await expect(rowFor(inputAt(page, 3)).locator('.worksheet-feedback')).toHaveText('Correct now');

  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/2 unassisted first checks correct');
  await expect(page.locator('#worksheet-answered')).toHaveText('2');
  await expect(page.locator('#worksheet-correct')).toHaveText('2');
  await expect(page.locator('#worksheet-accuracy')).toHaveText('100%');
  await expect(page.locator('#worksheet-score-copy')).toContainText('2/2 correct now');

  const saved = await page.evaluate(() => ({
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
    seen: JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || '{"version":1,"claims":[]}'),
    worksheets: JSON.parse(localStorage.getItem('soroban-dojo:worksheet-sessions') || '[]'),
  }));
  expect(saved.evidence).toHaveLength(3);
  expect(saved.seen.claims).toHaveLength(3);
  expect(saved.evidence.every((attempt) => attempt.source === 'worksheet' && attempt.skill === 'complements' && attempt.seed)).toBe(true);
  expect(saved.evidence.map((attempt) => attempt.events.map((event) => [event.kind, event.correct]))).toEqual([
    [['reveal-final', undefined]],
    [['submit', true]],
    [['submit', false], ['submit', true]],
  ]);
  expect(saved.worksheets[0]).toMatchObject({ answered: 2, correct: 2, accuracy: 100, submode: 'complement-balance' });

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#skill-map .skill-row').filter({ hasText: 'complements' })).toContainText('2/5 samples · 1 first-check correct');
  await expect(page.locator('#worksheet-focus-map .skill-row').filter({ hasText: 'complement balance' })).toContainText('best checked result 100% · corrections included');
});

test('worksheet evidence survives same-sheet rerenders and repeat reveals stay idempotent', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const first = inputAt(page, 0);
  const second = inputAt(page, 1);
  const firstAnswer = await first.getAttribute('data-answer');
  const secondAnswer = await second.getAttribute('data-answer');
  await page.getByText('After you generate').click();
  await first.fill(firstAnswer || '');
  await page.getByRole('button', { name: 'Reveal filled-row answers' }).click();
  await expect(page.locator('#worksheet-answered')).toHaveText('0');
  await expect(page.locator('#worksheet-score-copy')).toContainText('Checked result is unchanged');

  await rowFor(first).getByRole('button', { name: 'Reveal answer for worksheet question 1', exact: true }).click();
  await second.fill(secondAnswer || '');
  await rowFor(second).getByRole('button', { name: 'Check worksheet question 2', exact: true }).click();
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/1 unassisted first checks correct');

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  const revealBefore = before.find((attempt) => attempt.events.some((event) => event.kind === 'reveal-final'));
  expect(revealBefore.events.filter((event) => event.kind === 'reveal-final')).toHaveLength(1);

  await page.evaluate((attemptId) => {
    const ledger = JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]');
    const stale = ledger.find((attempt) => attempt.attemptId === attemptId);
    stale.events = stale.events.map((event) => event.kind === 'reveal-final'
      ? { ...event, at: new Date(Date.parse(event.at) + 1000).toISOString() }
      : event);
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify(ledger));
  }, revealBefore.attemptId);

  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-orientation', 'vertical');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/1 unassisted first checks correct');
  await rowFor(inputAt(page, 0)).getByRole('button', { name: 'Reveal answer for worksheet question 1', exact: true }).click();

  const afterRerender = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  const revealAfter = afterRerender.find((attempt) => attempt.attemptId === revealBefore.attemptId);
  expect(revealAfter.events.filter((event) => event.kind === 'reveal-final')).toHaveLength(1);
  expect(revealAfter.events.map((event) => event.seq)).toEqual([1]);
  expect(revealAfter.eligibility).toBe('prospective');

  await page.selectOption('#worksheet-level', 'L3');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('No unassisted first checks saved for this sheet yet');
});

test('presentation-only rerenders preserve exact live worksheet work, focus, time, and stored bytes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-30T00:00:00Z') });
  await page.goto('worksheets?preset=sequence-mix');
  await page.getByText('Advanced options').click();
  await page.getByText('After you generate').click();
  await page.selectOption('#worksheet-timer-mode', 'on');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.fastForward(4_000);
  await expect(page.locator('#worksheet-time')).toHaveText('4s');

  const inputs = page.locator('.worksheet-input');
  const questionIds = await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')));
  const answers = await inputs.evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.getAttribute('data-answer') || ''));
  await inputAt(page, 0).fill(answers[0]);
  await rowFor(inputAt(page, 0)).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await inputAt(page, 1).fill(String(Number(answers[1]) + 1));
  await rowFor(inputAt(page, 1)).getByRole('button', { name: 'Check worksheet question 2', exact: true }).click();
  await inputAt(page, 2).fill('12345');
  await rowFor(inputAt(page, 3)).getByRole('button', { name: 'Reveal answer for worksheet question 4', exact: true }).click();
  await inputAt(page, 2).focus();
  await inputAt(page, 2).evaluate((input) => input.setSelectionRange(1, 4));

  const before = await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
    status: document.querySelector('#worksheet-save-status')?.textContent,
    score: document.querySelector('#worksheet-score-copy')?.textContent,
  }));
  await page.clock.fastForward(2_000);
  await page.locator('#worksheet-orientation').evaluate((select) => {
    select.value = 'ledger';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  expect(await inputs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')))).toEqual(questionIds);
  await expect(inputAt(page, 0)).toHaveValue(answers[0]);
  await expect(rowFor(inputAt(page, 0)).locator('.worksheet-feedback')).toHaveText('Correct on first check');
  await expect(rowFor(inputAt(page, 0))).toHaveClass(/row-ok/);
  await expect(inputAt(page, 1)).toHaveValue(String(Number(answers[1]) + 1));
  await expect(rowFor(inputAt(page, 1)).locator('.worksheet-feedback')).toHaveText('Not correct yet');
  await expect(rowFor(inputAt(page, 1))).toHaveClass(/row-needs-work/);
  await expect(inputAt(page, 2)).toHaveValue('12345');
  await expect(inputAt(page, 2)).toBeFocused();
  expect(await inputAt(page, 2).evaluate((input) => [input.selectionStart, input.selectionEnd])).toEqual([1, 4]);
  await expect(rowFor(inputAt(page, 3)).locator('.worksheet-feedback')).toHaveText(`Answer revealed: ${answers[3]}`);
  await expect(rowFor(inputAt(page, 3))).toHaveClass(/row-revealed/);
  await expect(page.locator('#worksheet-save-status')).toHaveText(before.status || '');
  await expect(page.locator('#worksheet-score-copy')).toHaveText(before.score || '');
  await expect(page.locator('#worksheet-time')).toHaveText('6s');
  expect(await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }))).toEqual({ evidence: before.evidence, sessions: before.sessions });

  await page.clock.fastForward(2_000);
  await page.locator('#worksheet-style').evaluate((select) => {
    select.value = 'speed';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(inputAt(page, 2)).toBeFocused();
  await expect(inputAt(page, 2)).toHaveValue('12345');
  await expect(page.locator('#worksheet-save-status')).toHaveText(before.status || '');
  await expect(page.locator('#worksheet-score-copy')).toHaveText(before.score || '');
  await expect(page.locator('#worksheet-time')).toHaveText('8s');
  expect(await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }))).toEqual({ evidence: before.evidence, sessions: before.sessions });

  const thirdCheck = rowFor(inputAt(page, 2)).getByRole('button', { name: 'Check worksheet question 3', exact: true });
  await thirdCheck.focus();
  await page.clock.fastForward(2_000);
  await page.locator('#worksheet-orientation').evaluate((select) => {
    select.value = 'vertical';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(rowFor(inputAt(page, 2)).getByRole('button', { name: 'Check worksheet question 3', exact: true })).toBeFocused();
  await expect(page.locator('#worksheet-time')).toHaveText('10s');
  await expect(page.locator('#worksheet-save-status')).toHaveText(before.status || '');
  expect(await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }))).toEqual({ evidence: before.evidence, sessions: before.sessions });
});

test('answer-key entry preserves same-sheet inputs and passive rerenders do not repeat its side effects', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-30T00:00:00Z') });
  await page.goto('worksheets?preset=complements');
  await page.getByText('Advanced options').click();
  await page.getByText('After you generate').click();
  await page.selectOption('#worksheet-timer-mode', 'on');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.fastForward(3_000);

  const firstSheetIds = await page.locator('.worksheet-input').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')));
  const firstAnswer = (await inputAt(page, 0).getAttribute('data-answer')) || '';
  await inputAt(page, 0).fill(firstAnswer);
  await rowFor(inputAt(page, 0)).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await inputAt(page, 1).fill('9876');
  await page.selectOption('#worksheet-print-mode', 'answer-key');

  await expect(inputAt(page, 0)).toHaveValue(firstAnswer);
  await expect(inputAt(page, 1)).toHaveValue('9876');
  await expect(page.locator('.worksheet-feedback')).toHaveCount(40);
  expect(await page.locator('.worksheet-feedback').evaluateAll((nodes) => (
    nodes.every((node) => node.textContent?.startsWith('Answer revealed:'))
  ))).toBe(true);
  await expect(page.locator('#worksheet-save-status')).toContainText('Teacher answer key opened for 40 rows');
  await expect(page.locator('#worksheet-time')).toHaveText('3s');
  const afterAnswerKey = await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
    status: document.querySelector('#worksheet-save-status')?.textContent,
    score: document.querySelector('#worksheet-score-copy')?.textContent,
  }));

  await page.clock.fastForward(2_000);
  await page.selectOption('#worksheet-orientation', 'vertical');
  await expect(inputAt(page, 0)).toHaveValue(firstAnswer);
  await expect(inputAt(page, 1)).toHaveValue('9876');
  await expect(page.locator('#worksheet-save-status')).toHaveText(afterAnswerKey.status || '');
  await expect(page.locator('#worksheet-score-copy')).toHaveText(afterAnswerKey.score || '');
  await expect(page.locator('#worksheet-time')).toHaveText('5s');
  expect(await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    sessions: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }))).toEqual({ evidence: afterAnswerKey.evidence, sessions: afterAnswerKey.sessions });

  await page.getByRole('button', { name: 'Refresh questions' }).click();
  const nextSheetIds = await page.locator('.worksheet-input').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')));
  expect(nextSheetIds).not.toEqual(firstSheetIds);
  expect(await page.locator('.worksheet-feedback').evaluateAll((nodes) => (
    nodes.every((node) => node.textContent?.startsWith('Answer revealed:'))
  ))).toBe(true);
  await expect(page.locator('#worksheet-save-status')).toContainText('Teacher answer key opened for 40 rows');
  await expect(page.locator('#worksheet-time')).toHaveText('0s');
  const evidenceAfterRefresh = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  expect(evidenceAfterRefresh).toHaveLength(80);
  expect(nextSheetIds.every((questionId) => evidenceAfterRefresh.some((attempt) => (
    attempt.itemId === questionId && attempt.events.some((event) => event.kind === 'reveal-final')
  )))).toBe(true);
});

test('fresh worksheet identity clears transient work and resets running or paused time', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-07-30T00:00:00Z') });
  await page.goto('worksheets?preset=sequence-mix');
  await page.getByText('Advanced options').click();
  await page.getByText('After you generate').click();
  await page.selectOption('#worksheet-timer-mode', 'on');
  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.fastForward(4_000);

  const initialIds = await page.locator('.worksheet-input').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')));
  const answer = (await inputAt(page, 0).getAttribute('data-answer')) || '';
  await inputAt(page, 0).fill(answer);
  await rowFor(inputAt(page, 0)).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await inputAt(page, 1).fill('321');
  await page.getByRole('button', { name: 'Refresh questions' }).click();

  expect(await page.locator('.worksheet-input').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-question-id')))).not.toEqual(initialIds);
  await expect(inputAt(page, 0)).toHaveValue('');
  await expect(inputAt(page, 1)).toHaveValue('');
  await expect(rowFor(inputAt(page, 0)).locator('.worksheet-feedback')).toBeEmpty();
  await expect(page.locator('#worksheet-save-status')).toBeEmpty();
  await expect(page.locator('#worksheet-time')).toHaveText('0s');
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
  await page.clock.fastForward(2_000);
  await expect(page.locator('#worksheet-time')).toHaveText('0s');

  await page.getByRole('button', { name: 'Start timer' }).click();
  await page.clock.fastForward(3_000);
  await page.getByRole('button', { name: 'Pause timer' }).click();
  await expect(page.locator('#worksheet-time')).toHaveText('3s');
  await page.getByRole('button', { name: 'Refresh questions' }).click();
  await expect(page.locator('#worksheet-time')).toHaveText('0s');
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
});

test('divergent worksheet submit and reveal histories fail closed', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const first = inputAt(page, 0);
  const answer = (await first.getAttribute('data-answer')) || '';
  await rowFor(first).getByRole('button', { name: 'Reveal answer for worksheet question 1', exact: true }).click();

  await page.evaluate((submittedValue) => {
    const ledger = JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]');
    const attempt = ledger[0];
    const revealAt = attempt.events[0].at;
    attempt.events = [{
      seq: 1,
      kind: 'submit',
      at: new Date(Date.parse(revealAt) - 1000).toISOString(),
      value: submittedValue,
      correct: true,
    }];
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify(ledger));
  }, answer);

  await rowFor(first).getByRole('button', { name: 'Reveal answer for worksheet question 1', exact: true }).click();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  expect(saved).toHaveLength(1);
  expect(saved[0].events.map((event) => [event.seq, event.kind])).toEqual([[1, 'submit'], [2, 'reveal-final']]);
  expect(saved[0].eligibility).toBe('activity-only');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('No unassisted first checks saved');
});

test('returning to a prior worksheet configuration starts a fresh sheet without erasing evidence', async ({ page }) => {
  await page.goto('worksheets?preset=complements');

  const first = inputAt(page, 0);
  const originalQuestionId = await first.getAttribute('data-question-id');
  const originalCount = await page.locator('#worksheet-count').inputValue();
  const alternateCount = originalCount === '20' ? '40' : '20';
  await first.fill((await first.getAttribute('data-answer')) || '');
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();

  const original = await page.evaluate(() => ({
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]')[0],
    session: JSON.parse(localStorage.getItem('soroban-dojo:worksheet-sessions') || '[]')[0],
  }));
  expect(original.evidence).toMatchObject({ itemId: originalQuestionId, eligibility: 'prospective' });
  expect(original.session).toMatchObject({ answered: 1, correct: 1, accuracy: 100 });

  await page.getByText('Advanced options').click();
  await page.selectOption('#worksheet-count', alternateCount);
  await page.selectOption('#worksheet-count', originalCount);

  expect(await inputAt(page, 0).getAttribute('data-question-id')).not.toBe(originalQuestionId);
  const saved = await page.evaluate((sessionId) => ({
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
    originalSession: JSON.parse(localStorage.getItem('soroban-dojo:worksheet-sessions') || '[]')
      .find((session) => session.id === sessionId),
  }), original.session.id);
  expect(saved.evidence).toHaveLength(1);
  expect(saved.evidence[0]).toMatchObject({ attemptId: original.evidence.attemptId, eligibility: 'prospective' });
  expect(saved.evidence[0].events).toHaveLength(1);
  expect(saved.originalSession).toMatchObject({ answered: 1, correct: 1, accuracy: 100 });
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('No unassisted first checks saved for this sheet yet');
});

test('worksheet evidence retries preserve the original submit after an evidence-only failure', async ({ page }) => {
  await page.goto('worksheets?preset=complements');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__restoreWorksheetSetItem = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:mastery-evidence-v1') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });

  const first = inputAt(page, 0);
  const answer = await first.getAttribute('data-answer');
  await first.fill(answer || '');
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('Checked activity saved, but first-check evidence could not be saved');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('No unassisted first checks saved');

  await page.evaluate(() => window.__restoreWorksheetSetItem());
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();
  await expect(page.locator('#worksheet-save-status')).toContainText('Worksheet activity and evidence history saved');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1/1 unassisted first checks correct');
  const saved = await page.evaluate(() => ({
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'),
    seen: JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || '{"version":1,"claims":[]}'),
  }));
  expect(saved.evidence).toHaveLength(1);
  expect(saved.evidence[0].events.map((event) => event.kind)).toEqual(['submit', 'submit']);
  expect(saved.evidence[0].events[0].correct).toBe(true);
  expect(saved.seen.claims[0].attemptId).toBe(saved.evidence[0].attemptId);
});

test('worksheet claim failure saves activity-only evidence and never first-check credit', async ({ page }) => {
  await page.goto('worksheets?preset=complements');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:mastery-seen-items-v1') throw new DOMException('blocked', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });

  const first = inputAt(page, 0);
  await first.fill((await first.getAttribute('data-answer')) || '');
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();

  await expect(page.locator('#worksheet-save-status')).toContainText('first-check evidence could not be saved');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('No unassisted first checks saved');
  await expect(page.locator('#worksheet-first-check-copy')).toContainText('1 assisted or repeated row remains activity only');
  const evidence = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]'));
  expect(evidence).toHaveLength(1);
  expect(evidence[0]).toMatchObject({ source: 'worksheet', eligibility: 'activity-only' });
  expect(evidence[0].events).toHaveLength(1);
});

test('future read-only worksheet interactions remain tab-only and byte-identical', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 99, future: true }));
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify({ future: 'evidence' }));
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify({ future: 'claims' }));
    localStorage.setItem('soroban-dojo:worksheet-sessions', JSON.stringify([{ future: 'worksheet' }]));
  });
  await page.goto('worksheets?preset=complements');
  const before = await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    seen: localStorage.getItem('soroban-dojo:mastery-seen-items-v1'),
    worksheets: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }));

  const first = inputAt(page, 0);
  await first.fill((await first.getAttribute('data-answer')) || '');
  await rowFor(first).getByRole('button', { name: 'Check worksheet question 1', exact: true }).click();

  await expect(page.locator('#worksheet-save-status')).toContainText('remain only in this tab');
  const after = await page.evaluate(() => ({
    evidence: localStorage.getItem('soroban-dojo:mastery-evidence-v1'),
    seen: localStorage.getItem('soroban-dojo:mastery-seen-items-v1'),
    worksheets: localStorage.getItem('soroban-dojo:worksheet-sessions'),
  }));
  expect(after).toEqual(before);
});
