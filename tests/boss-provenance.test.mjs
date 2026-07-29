import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BOSS_PROVENANCE_VERSION,
  bossProvenanceLabel,
  createBossProvenance,
  isCanonicalBossProvenanceRecord,
  isBossComplete,
  normalizeBossCertificateRecord,
  normalizeBossCompletionRecord,
  normalizeBossProvenanceRecord,
  resolveBossProvenance,
} from '../src/lib/boss-provenance.js';

test('boss completion source remains explicit and user-facing', () => {
  const playable = createBossProvenance({ source: 'playable', completedAt: '2026-07-29T00:00:00.000Z', ruleVersion: 1 });
  const manual = createBossProvenance({ source: 'manual', completedAt: '2026-07-29T00:00:00.000Z' });
  assert.equal(playable.version, BOSS_PROVENANCE_VERSION);
  assert.equal(bossProvenanceLabel(playable), 'Playable Dojo clear');
  assert.equal(bossProvenanceLabel(manual), 'Offline self-recorded clear');
  assert.equal(bossProvenanceLabel({ source: 'legacy-unknown' }), 'Legacy clear (source unknown)');
});

test('invalid provenance never becomes a playable clear', () => {
  assert.deepEqual(normalizeBossProvenanceRecord({
    L0: { source: 'playable', version: 1, completedAt: '2026-07-29T00:00:00.000Z', ruleVersion: 1 },
    L1: { source: 'invented', version: 1 },
    L2: true,
  }), {
    L0: { source: 'playable', version: 1, completedAt: '2026-07-29T00:00:00.000Z', ruleVersion: 1, evidenceId: null },
  });
  assert.equal(resolveBossProvenance(false, { source: 'playable' }), null);
  assert.equal(resolveBossProvenance(true, { source: 'playable', version: 1 }).source, 'legacy-unknown');
});

test('current completion sources require canonical supporting facts', () => {
  assert.throws(() => createBossProvenance({ source: 'playable', completedAt: '2026-07-29T00:00:00.000Z' }), /rule version/);
  assert.throws(() => createBossProvenance({ source: 'manual' }), /completion time/);
  assert.deepEqual(normalizeBossProvenanceRecord({
    L0: { source: 'playable', version: 1, completedAt: 'not-a-date', ruleVersion: 1 },
    L1: { source: 'manual', version: 1 },
  }), {});
});

test('only literal completions and valid certificate records can render proof', () => {
  assert.equal(isBossComplete(true), true);
  for (const value of [false, 'true', 'false', 1, {}, []]) assert.equal(isBossComplete(value), false);
  assert.deepEqual(normalizeBossCompletionRecord({ L0: true, L1: 'true', L2: 1 }), { L0: true });
  assert.deepEqual(normalizeBossCertificateRecord({
    L0: { name: ' Learner ', date: '2026-07-29T00:00:00.000Z', source: 'playable' },
    L3: { name: 'British learner', date: '29/07/2026' },
    L1: { name: '', date: '2026-07-29' },
    L2: { name: 'Forged', date: 'not-a-date' },
  }), {
    L0: { name: 'Learner', date: '2026-07-29T00:00:00.000Z', source: 'playable' },
    L3: { name: 'British learner', date: '29/07/2026', source: null },
  });
  const provenance = createBossProvenance({ source: 'playable', completedAt: '2026-07-29T00:00:00.000Z', ruleVersion: 1 });
  assert.equal(isCanonicalBossProvenanceRecord({ L0: provenance }), true);
  assert.equal(isCanonicalBossProvenanceRecord({ L0: { ...provenance, futureField: true } }), false);
});
