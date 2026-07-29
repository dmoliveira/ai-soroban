import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const storageFixture = JSON.parse(fs.readFileSync(new URL('../fixtures/storage-v0.3.json', import.meta.url), 'utf8')).values;

test('0.3 browser state migrates additively without changing legacy bytes or theme', async ({ page }) => {
  await page.addInitScript((values) => {
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, value));
  }, storageFixture);
  await page.goto('');

  await expect.poll(() => page.evaluate(() => localStorage.getItem('soroban-dojo:state-schema'))).not.toBeNull();
  const state = await page.evaluate((legacy) => ({
    changedLegacy: Object.entries(legacy).filter(([key, value]) => localStorage.getItem(key) !== value),
    theme: localStorage.getItem('soroban-dojo:theme'),
    evidence: JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || 'null'),
    seenItems: JSON.parse(localStorage.getItem('soroban-dojo:mastery-seen-items-v1') || 'null'),
    scores: JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores-v2') || 'null'),
    provenance: JSON.parse(localStorage.getItem('soroban-dojo:boss-provenance-v1') || 'null'),
  }), storageFixture);
  expect(state.changedLegacy).toEqual([]);
  expect(state.theme).toBe('sumi');
  expect(state.evidence).toEqual([]);
  expect(state.seenItems).toEqual({ version: 1, claims: [] });
  expect(state.scores.legacy.scores['table-tower']).toBe(500);
  expect(state.scores.bestByScope).toEqual({});
  expect(state.provenance.L0.source).toBe('legacy-unknown');
});

test('equivalent exercise wording passes while assistance remains outside mastery evidence', async ({ page }) => {
  await page.goto('exercises/l1/set-eight');
  await page.locator('#exercise-response').fill('Use the upper bead and three lower beads.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-feedback')).toContainText('Correct');
  await expect(page.locator('#exercise-feedback')).toContainText('Saved as unassisted first-check evidence');
  await expect(page.locator('#exercise-state-memory')).toContainText('unassisted first-check evidence');
  await page.locator('#reset-exercise').click();
  await page.locator('#exercise-response').fill('Use the upper bead and three lower beads.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-state-memory')).toContainText('without new first-check credit');

  await page.goto('exercises/l0/name-the-beam');
  await page.locator('#hint-exercise').click();
  await page.locator('#exercise-response').fill('Beads count when moved toward the beam.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-feedback')).toContainText('Correct');
  await expect(page.locator('#exercise-state-memory')).toContainText('without new first-check credit');

  const summaries = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]').map((attempt) => ({
    itemId: attempt.itemId,
    kinds: attempt.events.map((event) => event.kind),
    firstCorrect: attempt.events.find((event) => event.kind === 'submit')?.correct,
  })));
  expect(summaries).toEqual(expect.arrayContaining([
    expect.objectContaining({ itemId: 'exercise-l1-002', kinds: ['submit'], firstCorrect: true }),
    expect.objectContaining({ itemId: 'exercise-l0-002', kinds: ['hint', 'submit'], firstCorrect: true }),
  ]));

  await page.goto('progress');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.getByRole('heading', { name: 'First-check evidence by practice area' })).toBeVisible();
  await expect(page.locator('.skill-row').filter({ hasText: 'number setting' })).toContainText('1/5 samples');
  await expect(page.locator('.skill-row').filter({ hasText: 'abacus orientation' })).toContainText('0/5 samples');
});

test('practice reveals preserve correction accuracy but cannot create first-check evidence', async ({ page }) => {
  await page.goto('practice');
  await page.locator('#start-practice-now').click();
  await page.locator('#reveal-final').click();
  const feedback = await page.locator('#feedback-panel').textContent();
  const answer = feedback.match(/Final number:\s*(-?\d+)/)?.[1];
  expect(answer).toBeTruthy();
  await page.locator('#answer-input').fill(answer);
  await page.locator('#verify-answer').click();

  const evidence = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1') || '[]')[0]);
  expect(evidence.events.map((event) => event.kind)).toEqual(['reveal-final', 'submit']);
  expect(evidence.events.at(-1).correct).toBe(true);
});

test('an unassisted miss remains the first-check sample after a correction', async ({ page }) => {
  await page.goto('exercises/l0/set-thirty-one');
  await page.locator('#exercise-response').fill('30');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-state-memory')).toContainText('first-check miss for review');
  await page.locator('#exercise-response').fill('Set three on the tens rod and one on the ones rod.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-state-memory')).toContainText('first-check miss with a later correction');
  const summary = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1'))[0]);
  expect(summary.events.map((event) => event.correct)).toEqual([false, true]);
});

test('boss clears expose playable and offline provenance instead of one earned boolean', async ({ page }) => {
  await page.goto('boss-rounds');
  const l0 = page.locator('.boss-round-card[data-level="L0"]');
  const phases = JSON.parse(await l0.locator('.boss-session-panel').getAttribute('data-phases'));
  await l0.locator('.boss-session-start').click();
  for (const phase of phases) {
    await l0.locator('.boss-session-answer').fill(String(phase.answer));
    await l0.locator('.boss-session-check').click();
  }
  await expect(l0.locator('.boss-round-status')).toHaveText('Playable Dojo clear');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:boss-provenance-v1')).L0.source)).toBe('playable');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:boss-certificates')).L0.date)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

  const l1 = page.locator('.boss-round-card[data-level="L1"]');
  await l1.locator('.boss-round-toggle').click();
  await expect(l1.locator('.boss-round-status')).toHaveText('Offline self-recorded clear');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:boss-provenance-v1')).L1.source)).toBe('manual');
  await page.locator('#certificate-level').selectOption('L1');
  await expect(page.locator('#certificate-copy')).toContainText('Offline self-recorded clear');
});

test('a boss clear never appears when its completion record cannot be saved', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:boss-rounds') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
  });
  await page.goto('boss-rounds');
  const l0 = page.locator('.boss-round-card[data-level="L0"]');
  await l0.locator('.boss-round-toggle').click();
  await expect(l0.locator('.boss-session-feedback')).toContainText('remains pending');
  await expect(l0.locator('.boss-round-status')).toHaveText('Not completed yet.');
  await expect(page.locator('#print-certificate')).toBeDisabled();
  const stored = await page.evaluate(() => ({
    completed: JSON.parse(localStorage.getItem('soroban-dojo:boss-rounds') || '{}').L0 || false,
    provenance: JSON.parse(localStorage.getItem('soroban-dojo:boss-provenance-v1') || '{}').L0 || null,
    certificate: JSON.parse(localStorage.getItem('soroban-dojo:boss-certificates') || '{}').L0 || null,
  }));
  expect(stored).toEqual({ completed: false, provenance: null, certificate: null });
});

test('orphaned certificates and malformed current provenance cannot claim a current clear', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:boss-certificates', JSON.stringify({
      L0: { name: 'Orphan', date: '7/29/2026', source: 'playable' },
      L1: { name: 'Legacy learner', date: '7/29/2026', source: 'playable' },
      L2: { name: 'Truthy forgery', date: '7/29/2026', source: 'playable' },
    }));
    localStorage.setItem('soroban-dojo:boss-rounds', JSON.stringify({ L1: true, L2: 'true' }));
    localStorage.setItem('soroban-dojo:boss-provenance-v1', JSON.stringify({
      L1: { version: 1, source: 'playable', completedAt: null, ruleVersion: 1 },
      L2: { version: 1, source: 'playable', completedAt: '2026-07-29T00:00:00.000Z', ruleVersion: 1, evidenceId: null },
    }));
  });
  await page.goto('progress');
  await expect(page.locator('#certificate-summary-list')).not.toContainText('L0 certificate');
  await expect(page.locator('#certificate-summary-list')).toContainText('L1 certificate');
  await expect(page.locator('#certificate-summary-list')).toContainText('Legacy clear (source unknown)');
  await expect(page.locator('#certificate-summary-list')).not.toContainText('L2 certificate');
  await expect(page.locator('#boss-badge-strip')).toContainText('L1 · Legacy clear (source unknown)');
  await expect(page.locator('#boss-badge-strip')).not.toContainText('L2 · Playable Dojo clear');
});

test('a future state schema makes learner writes read-only instead of downgrading data', async ({ page }) => {
  const futureScoreBytes = '{"version":99,"future":{"best":"keep-byte-exact"}}';
  await page.addInitScript((scoreBytes) => {
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 99, migratedAt: '2035-01-01T00:00:00.000Z' }));
    localStorage.setItem('soroban-dojo:minigame-scores-v2', scoreBytes);
  }, futureScoreBytes);
  await page.goto('mini-games');
  await expect(page.locator('#storage-compatibility-notice')).toContainText('Saved progress is protected and read-only');
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-start-selected').click();
  for (let index = 0; index < 5; index += 1) {
    const prompt = await page.locator('#mini-game-prompt').textContent();
    const match = prompt.match(/completes (\d+) to (\d+)/);
    await page.locator('#mini-game-answer').fill(String(Number(match[2]) - Number(match[1])));
    await page.locator('#mini-game-check').click();
  }
  await expect(page.locator('#mini-game-result-reason')).toContainText('did not save it as a best');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:minigame-scores-v2'))).toBe(futureScoreBytes);

  await page.goto('exercises/l1/set-eight');
  await page.locator('#exercise-response').fill('Use the upper bead and three lower beads.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-feedback')).toContainText('did not save it to Progress');
  expect(await page.evaluate(() => localStorage.getItem('soroban-dojo:mastery-evidence-v1'))).toBeNull();

  await page.goto('lessons/l0/parts-of-the-soroban');
  await expect(page.locator('.lesson-complete-toggle')).toBeDisabled();
});

test('browser storage failures never produce saved evidence or best-score claims', async ({ page }) => {
  await page.goto('exercises/l1/set-eight');
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:mastery-evidence-v1') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
  });
  await page.locator('#exercise-response').fill('Use the upper bead and three lower beads.');
  await page.locator('#verify-exercise').click();
  await expect(page.locator('#exercise-feedback')).toContainText('did not save it to Progress');
  await expect(page.locator('#exercise-state-memory')).toContainText('Not saved');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:mastery-evidence-v1')))).toEqual([]);

  await page.goto('mini-games');
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === 'soroban-dojo:minigame-scores-v2') throw new DOMException('blocked', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    };
  });
  await page.locator('#mini-game-question-count').selectOption('5');
  await page.locator('#mini-game-start-selected').click();
  for (let index = 0; index < 5; index += 1) {
    const prompt = await page.locator('#mini-game-prompt').textContent();
    const match = prompt.match(/completes (\d+) to (\d+)/);
    await page.locator('#mini-game-answer').fill(String(Number(match[2]) - Number(match[1])));
    await page.locator('#mini-game-check').click();
  }
  await expect(page.locator('#mini-game-result-reason')).toContainText('did not save it as a best');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:minigame-scores-v2')).bestByScope)).toEqual({});
});

test('opaque future challenge payloads stay unscored and survive current history writes', async ({ page }) => {
  const futureSession = {
    id: 'future-opaque',
    challengeKey: 'future-bead-rule',
    challengeSeed: 'future-seed',
    challengeRuleVersion: 99,
    createdAt: '2035-01-01T00:00:00.000Z',
    completed: true,
    currentIndex: 99,
    finalScore: 100,
    questions: { format: 'future-compressed', payload: 'preserve-me' },
    responses: { future: true },
  };
  await page.addInitScript((session) => {
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([session]));
  }, futureSession);
  await page.goto('practice');
  const futureCard = page.locator('.session-card').filter({ hasText: 'future-bead-rule' });
  await expect(futureCard).toContainText('Result unavailable for this saved rule version');
  await expect(futureCard).not.toContainText('100/100');
  await page.locator('#start-practice-now').click();
  const preserved = await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions')).find((entry) => entry.id === 'future-opaque'));
  expect(preserved).toEqual(futureSession);
  await page.goto('progress');
  await expect(page.locator('#best-score')).toHaveText('—');
  await expect(page.locator('#journey-copy')).toContainText('no saved accuracy is available');
  await expect(page.locator('#journey-copy')).not.toContainText('0/100');
});

test('typed-but-noninteger challenge versions remain unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([{
      id: 'string-version',
      challengeKey: 'bead-match',
      challengeSeed: 'stored-seed',
      challengeRuleVersion: '1',
      questions: [{ id: 'must-not-rebuild', prompt: 'Preserve this payload' }],
      responses: {},
    }]));
  });
  await page.goto('practice');
  const card = page.locator('.session-card').filter({ hasText: 'bead-match' });
  await expect(card.getByRole('button', { name: 'Resume unavailable' })).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Replay unavailable' })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('soroban-dojo:practice-sessions'))[0].questions[0].id)).toBe('must-not-rebuild');
});

test('conflicting seen-item ownership cannot appear as qualified progress', async ({ page }) => {
  await page.addInitScript(() => {
    const attempt = {
      version: 1,
      attemptId: 'prospective-owner',
      source: 'exercise',
      itemId: 'exercise-l0-006',
      skill: 'place-value',
      level: 'L0',
      rule: { id: 'exercise-l0-006', version: 1 },
      eligibility: 'prospective',
      seed: null,
      startedAt: '2026-07-29T00:00:00.000Z',
      events: [{ seq: 1, kind: 'submit', at: '2026-07-29T00:00:01.000Z', value: '31', correct: true }],
    };
    localStorage.setItem('soroban-dojo:state-schema', JSON.stringify({ version: 1 }));
    localStorage.setItem('soroban-dojo:mastery-evidence-v1', JSON.stringify([attempt]));
    localStorage.setItem('soroban-dojo:mastery-seen-items-v1', JSON.stringify({
      version: 1,
      claims: [{ itemId: attempt.itemId, attemptId: 'different-owner', firstSeenAt: '2026-07-28T00:00:00.000Z' }],
    }));
  });
  await page.goto('progress');
  await expect(page.locator('#storage-compatibility-notice')).toContainText('could not be validated');
  await page.getByText('More progress, history, and rewards').click();
  await expect(page.locator('.skill-row').filter({ hasText: 'place value' })).toContainText('0/5 samples');
  await expect(page.locator('#reflection-chips')).toContainText('No first-check evidence yet');
});

test('unsupported saved challenge versions remain visible but cannot resume or replay', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('soroban-dojo:practice-sessions', JSON.stringify([{
      id: 'future-challenge',
      challengeKey: 'bead-match',
      challengeSeed: 'future-seed',
      challengeRuleVersion: 99,
      createdAt: '2026-07-29T00:00:00.000Z',
      format: 'single',
      level: 'L0',
      currentIndex: 0,
      completed: false,
      questions: [{ id: 'future-question', prompt: 'Preserved future question' }],
      responses: {},
    }]));
  });
  await page.goto('practice');

  await expect(page.getByRole('button', { name: 'Resume unavailable' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Replay unavailable' })).toBeDisabled();
  await page.getByText('Adjust session setup').click();
  await page.locator('#resume-latest').click();
  await expect(page.locator('#feedback-panel')).toContainText('unsupported rule version');
  await expect(page.locator('#session-id')).toHaveText('—');
});
