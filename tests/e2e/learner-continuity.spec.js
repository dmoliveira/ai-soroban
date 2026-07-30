import { expect, test } from '@playwright/test';
import { installReviewState } from './review-state.js';

const placementState = (level, title, reason) => JSON.stringify({
  choice: { level, title, reason },
  answers: {},
});

const continuityCard = (page) => page.locator('[data-continuity-next-action]').first();

test('Practice hero has a usable HTML fallback and becomes a resume action after starting', async ({ page, baseURL }) => {
  const response = await page.request.get('practice');
  expect(response.ok()).toBe(true);
  const primaryMarkup = (await response.text()).match(/<a\b[^>]*id="practice-primary-action"[^>]*>/)?.[0];
  const fallbackPath = new URL('practice', baseURL).pathname;
  expect(primaryMarkup).toContain(`href="${fallbackPath}?level=L0&amp;skill=abacus-orientation&amp;start=1"`);

  await page.goto('practice');
  const primary = page.locator('#practice-primary-action');
  await expect(primary).toHaveAttribute('data-continuity-kind', 'setup');
  await expect(primary).toHaveAttribute('href', /practice\?level=L0&skill=abacus-orientation&start=1$/);
  await primary.click();

  await expect(page.locator('#answer-input')).toBeFocused();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]'));
  expect(sessions).toHaveLength(1);
  await expect(primary).toHaveAttribute('data-continuity-kind', 'resume');
  await expect(primary).toHaveText('Resume saved session');
  await expect(primary).toHaveAttribute('href', new RegExp(`practice\\?resume=${sessions[0].id}$`));
  const card = continuityCard(page);
  await expect(card).toHaveAttribute('data-continuity-kind', 'resume');
  await expect(card).toBeHidden();
  await expect(card.locator('[data-continuity-primary]')).toHaveText('Resume saved session');
  await expect(card.locator('[data-continuity-primary]')).toHaveAttribute(
    'href',
    new RegExp(`practice\\?resume=${sessions[0].id}$`),
  );
});

test('unfinished safe sessions outrank review, weekly-plan, and placement context', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:path', 'adults');
    localStorage.setItem('soroban-dojo:placement-result', JSON.stringify({
      choice: { level: 'L4', title: 'Advanced', reason: 'Start multiplication and division patterns.' },
      answers: {},
    }));
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      weak: { status: 'needs-review', level: 'L4', skill: 'division' },
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'review:division',
      lesson: { done: false },
      exercise: { done: false },
      worksheet: { done: false },
    }));
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([{
      id: 'dojo-resume-exact',
      level: 'L3',
      type: 'generated',
      format: 'single',
      completed: false,
      currentIndex: 0,
      questions: [{ id: 'q-1', title: 'One plus one', prompt: '1 + 1', answer: 2, steps: ['Add one.'] }],
      responses: {},
    }]));
  });

  await page.goto('');
  const card = continuityCard(page);
  await expect(card).toHaveAttribute('data-continuity-kind', 'resume');
  await expect(card).toContainText('Resume your saved L3 session');
  await expect(card.getByRole('link', { name: 'Resume saved session' })).toHaveAttribute('href', /practice\?resume=dojo-resume-exact$/);
  await expect(card).toContainText('Adults route');
  await expect(card).toContainText('L4 Advanced');
});

test('Practice hero mirrors the strongest saved resume action', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([{
      id: 'hero-resume-exact',
      level: 'L2',
      type: 'generated',
      format: 'single',
      completed: false,
      currentIndex: 0,
      questions: [{ id: 'q-hero', title: 'Complete ten', prompt: '7 + 3', answer: 10, steps: ['Complete ten.'] }],
      responses: {},
    }]));
  });

  await page.goto('practice');
  const primary = page.locator('#practice-primary-action');
  await expect(primary).toHaveAttribute('data-continuity-kind', 'resume');
  await expect(primary).toHaveText('Resume saved session');
  await expect(primary).toHaveAttribute('href', /practice\?resume=hero-resume-exact$/);
  await primary.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('#session-id')).toHaveText('hero-resume-exact');
  await expect(page.locator('#answer-input')).toBeFocused();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions') || '[]'))).toHaveLength(1);
});

test('review targets are focused and stale weekly plans are not promoted', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:placement-result', JSON.stringify({
      choice: { level: 'L4', title: 'Advanced', reason: 'Start multiplication and division patterns.' },
      answers: {},
    }));
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      weak: { status: 'needs-review', level: 'L4', skill: 'division' },
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'placement:L4',
      lesson: { done: false },
      exercise: { done: false },
      worksheet: { done: false },
    }));
  });

  await page.goto('progress');
  const card = continuityCard(page);
  await expect(card).toHaveAttribute('data-continuity-kind', 'review');
  await expect(card).toContainText('Repair quotient building next');
  await expect(card.getByRole('link', { name: 'Start quotient building practice' })).toHaveAttribute('href', /practice\?level=L4&skill=division&start=1$/);
  await expect(card.getByRole('link', { name: 'Open matching worksheet' })).toHaveAttribute('href', /worksheets\?preset=division-focus&submode=quotient-building$/);
  await expect(page.locator('.weekly-plan-panel')).toHaveCount(0);
});

test('continuity and Progress use retained first-check focus before conflicting activity', async ({ page }) => {
  await installReviewState(page, {
    firstCheckSkill: 'division',
    activitySkills: ['multiplication', 'multiplication', 'multiplication'],
  });

  await page.goto('progress');

  const card = continuityCard(page);
  await expect(card).toHaveAttribute('data-continuity-kind', 'review');
  await expect(card).toContainText('Repair quotient building next');
  await expect(card).toContainText('1 answer from your first unassisted check');
  await expect(page.locator('#review-items')).toHaveText('1');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#reflection-title')).toHaveText('Review quotient building next');
  await expect(page.locator('#reflection-copy')).toContainText('answer from your first unassisted check');
});

test('continuity and Progress disclose incomplete retained first-check history', async ({ page }) => {
  await installReviewState(page, { firstCheckSkill: 'division', incomplete: true });

  await page.goto('progress');

  await expect(continuityCard(page)).toContainText('Some older first-check details are missing');
  await expect(continuityCard(page)).toContainText('known misses stay in review');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#reflection-copy')).toContainText('Some older first-check details are missing');
});

test('Progress rejects malformed seen-index ownership while keeping cautious activity fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const attempt = {
      version: 1,
      attemptId: 'future-owner',
      source: 'exercise',
      itemId: 'exercise-l0-006',
      skill: 'place-value',
      level: 'L0',
      rule: { id: 'exercise-l0-006', version: 1 },
      eligibility: 'prospective',
      seed: null,
      startedAt: '2026-07-30T00:00:00.000Z',
      events: [{ seq: 1, kind: 'submit', at: '2026-07-30T00:00:01.000Z', value: '31', correct: true }],
    };
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 1 }));
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify([attempt]));
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify({
      version: 99,
      claims: [{ itemId: attempt.itemId, attemptId: attempt.attemptId, firstSeenAt: attempt.events[0].at }],
    }));
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      legacy: { status: 'needs-review', skill: 'division', level: 'L4' },
    }));
  });

  await page.goto('progress');

  await expect(page.locator('#review-items')).toHaveText('1');
  await expect(continuityCard(page)).toContainText('saved review item');
  await expect(continuityCard(page)).toContainText('Some older first-check details are missing');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('#reflection-chips')).toContainText('No first-check evidence yet');
  await expect(page.locator('.skill-row').filter({ hasText: 'place value' })).toContainText('0/5 samples');
});

test('a default new-learner plan becomes stale after non-review progress appears', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:exercise-states', JSON.stringify({
      complete: { status: 'got-it', skill: 'addition', level: 'L1' },
    }));
    localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
      continuityKey: 'default:new',
      planId: 'foundations',
      target: 'foundations',
      lesson: { id: 'lesson-l0-002', done: false },
      exercise: { id: 'exercise-l0-003', done: false },
      worksheet: { href: '/soroban-dojo/worksheets?preset=foundations-focus&submode=arithmetic-rhythm', done: false },
    }));
  });

  await page.goto('');
  await expect(continuityCard(page)).toHaveAttribute('data-continuity-kind', 'setup');

  await page.goto('daily-drills');
  await expect(page.locator('#daily-drill-focus')).toContainText('No fresh weekly plan');
});

test('placement-aware Practice action starts only after the learner activates it', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript((placement) => {
    localStorage.setItem('soroban-dojo:placement-result', placement);
  }, placementState('L4', 'Advanced', 'Start multiplication and division patterns.'));

  await page.goto('practice');
  const card = continuityCard(page);
  await expect(card).toHaveAttribute('data-continuity-kind', 'placement');
  await expect(page.locator('#session-title')).toHaveText('No session selected yet');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:practice-sessions'))).toBeNull();

  const start = card.getByRole('link', { name: 'Start focused practice' });
  await start.focus();
  await expect(start).toBeInViewport();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/practice\/?\?level=L4&skill=multiplication&start=1$/);
  await expect(page.locator('#session-title')).toHaveText('multiplication · L4 session');
  await expect(continuityCard(page)).toBeHidden();
  const latest = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions'))[0]);
  expect(latest).toMatchObject({ level: 'L4', skill: 'multiplication', completed: false });
});

test('an explicit resume id outranks simultaneous level, skill, and start intent', async ({ page }) => {
  await page.goto('practice?level=L2&skill=complements&start=1');
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions'))[0]);
  expect(original).toMatchObject({ level: 'L2', skill: 'complements', completed: false });

  await page.goto(`practice?resume=${encodeURIComponent(original.id)}&level=L5&skill=anzan&start=1`);
  await expect(page.locator('#session-id')).toHaveText(original.id);
  await expect(page.locator('#session-title')).toHaveText('complements · L2 session');
  await expect(continuityCard(page)).toBeHidden();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions')));
  expect(sessions).toHaveLength(1);
  expect(sessions[0].id).toBe(original.id);
});

test('an unknown explicit resume id fails visibly and does not start fallback intent', async ({ page }) => {
  await page.goto('practice?resume=missing-exact-id&level=L5&skill=anzan&start=1');
  await expect(page.locator('#practice-intent-feedback')).toBeVisible();
  await expect(page.locator('#practice-intent-feedback')).toHaveText('No saved session matched that exact ID on this device.');
  await expect(page.locator('#session-title')).toHaveText('No session selected yet');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:practice-sessions'))).toBeNull();
});

test('placement-aware weekly state becomes fresh only after an explicit plan update', async ({ page }) => {
  await page.addInitScript((placement) => {
    if (!localStorage.getItem('soroban-dojo:placement-result')) {
      localStorage.setItem('soroban-dojo:placement-result', placement);
    }
    if (!localStorage.getItem('soroban-dojo:weekly-study-plan')) {
      localStorage.setItem('soroban-dojo:weekly-study-plan', JSON.stringify({
        continuityKey: 'placement:L2',
        planId: 'complements',
        lesson: { id: 'lesson-l2-002', done: false },
        exercise: { id: 'exercise-l2-003', done: false },
        worksheet: { href: '/soroban-dojo/worksheets?preset=complements&submode=complement-balance', done: false },
      }));
    }
  }, placementState('L5', 'Mastery', 'Use short mental soroban sequences.'));

  await page.goto('');
  await expect(continuityCard(page)).toHaveAttribute('data-continuity-kind', 'placement');

  await page.goto('study-plan');
  await expect(page.locator('#weekly-plan-title')).toHaveText('Mental stability week');
  await page.getByRole('button', { name: 'Mark lesson done' }).click();
  const savedPlan = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:weekly-study-plan')));
  expect(savedPlan).toMatchObject({
    continuityKey: 'placement:L5',
    planId: 'mental',
    lesson: { id: 'lesson-l5-001', done: true },
    exercise: { id: 'exercise-l5-001', done: false },
    worksheet: { done: false },
  });

  await page.goto('');
  await expect(continuityCard(page)).toHaveAttribute('data-continuity-kind', 'weekly-plan');
  await expect(continuityCard(page)).toContainText('Continue your weekly exercise step');
});

test('bare worksheet submodes resolve to compatible presets and empty meters stay zero', async ({ page }) => {
  await page.goto('worksheets?submode=quotient-building');
  await expect(page.locator('[data-preset="division-focus"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#worksheet-level')).toHaveValue('L4');
  await expect(page.locator('#worksheet-submode')).toHaveValue('quotient-building');

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  const row = page.locator('#worksheet-focus-map .skill-row').filter({ hasText: 'quotient building' });
  await expect(row.locator('.skill-meter-fill')).toHaveCSS('width', '0px');
  await expect(row.locator('.skill-meter')).toHaveAttribute('aria-label', 'quotient building: not trained yet');
  await expect(row.getByRole('link', { name: 'Train' })).toHaveAttribute('href', /worksheets\?preset=division-focus&submode=quotient-building$/);
});

test('same-tab route changes refresh the Home recommendation without a reload', async ({ page }) => {
  await page.goto('');
  await expect(continuityCard(page)).toHaveAttribute('data-continuity-kind', 'setup');
  await page.getByRole('button', { name: 'Use children route' }).click();
  await expect(continuityCard(page)).toHaveAttribute('data-continuity-kind', 'route');
  await expect(continuityCard(page)).toContainText('Continue the children route');
});
