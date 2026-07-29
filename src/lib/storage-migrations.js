import { createBossProvenance, isCanonicalBossProvenanceRecord } from './boss-provenance.js';
import { buildMasterySeenIndex, isCanonicalAttemptEvidence, isCanonicalMasterySeenIndex, normalizeEvidenceLedger, normalizeMasterySeenIndex } from './mastery.js';
import { isCanonicalScoreStore, normalizeScoreStore } from './scoring.js';
import { STORAGE_KEYS, parseStoredJson, normalizeStoredRecord, setStorageCompatibility } from './storage.js';

export const CURRENT_STATE_SCHEMA_VERSION = 1;
export const COMPATIBILITY_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.stateSchema,
  STORAGE_KEYS.masteryEvidence,
  STORAGE_KEYS.masterySeenItems,
  STORAGE_KEYS.miniGameScoresV2,
  STORAGE_KEYS.bossProvenance,
]);

const safeGet = (storage, key) => {
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch {
    return { ok: false, value: null };
  }
};
const safeWrite = (storage, key, value) => {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const validEvidence = (value) => {
  if (!Array.isArray(value)
    || value.length > 400
    || !value.every(isCanonicalAttemptEvidence)
    || new Set(value.map((attempt) => attempt.attemptId)).size !== value.length) return false;
  const exposedItems = new Set();
  return value.every((attempt) => {
    if (attempt.events.length === 0) return true;
    if (attempt.eligibility === 'prospective' && exposedItems.has(attempt.itemId)) return false;
    exposedItems.add(attempt.itemId);
    return true;
  });
};
const validScoreStore = isCanonicalScoreStore;
const validProvenance = isCanonicalBossProvenanceRecord;

const ensureCompanion = (storage, key, initialValue, validate, written) => {
  const stored = safeGet(storage, key);
  if (!stored.ok) return false;
  if (stored.value !== null) return validate(parseStoredJson(stored.value, null));
  if (!safeWrite(storage, key, initialValue)) return false;
  written.push(key);
  return true;
};

export const ensureStorageCompatibility = (storage, { now = new Date().toISOString() } = {}) => {
  const finish = (result) => setStorageCompatibility(storage, result);
  if (!storage?.getItem || !storage?.setItem) return finish({ complete: false, writable: false, future: false, written: [], failedKey: null });
  const markerRead = safeGet(storage, STORAGE_KEYS.stateSchema);
  if (!markerRead.ok) return finish({ complete: false, writable: false, future: false, written: [], failedKey: STORAGE_KEYS.stateSchema });
  const marker = parseStoredJson(markerRead.value, null);
  const markerVersion = Number.isInteger(marker?.version) ? marker.version : 0;
  if (markerVersion > CURRENT_STATE_SCHEMA_VERSION) return finish({ complete: true, writable: false, future: true, written: [], failedKey: null });

  const legacyReads = {
    [STORAGE_KEYS.miniGameScores]: safeGet(storage, STORAGE_KEYS.miniGameScores),
    [STORAGE_KEYS.miniGameMedals]: safeGet(storage, STORAGE_KEYS.miniGameMedals),
    [STORAGE_KEYS.bossRounds]: safeGet(storage, STORAGE_KEYS.bossRounds),
  };
  const unreadable = Object.entries(legacyReads).find(([, result]) => !result.ok);
  if (unreadable) return finish({ complete: false, writable: false, future: false, written: [], failedKey: unreadable[0] });
  const legacyScores = normalizeStoredRecord(parseStoredJson(legacyReads[STORAGE_KEYS.miniGameScores].value, {}));
  const legacyMedals = normalizeStoredRecord(parseStoredJson(legacyReads[STORAGE_KEYS.miniGameMedals].value, {}));
  const legacyBosses = normalizeStoredRecord(parseStoredJson(legacyReads[STORAGE_KEYS.bossRounds].value, {}));
  const bossProvenance = Object.fromEntries(Object.entries(legacyBosses)
    .filter(([, completed]) => completed === true)
    .map(([level]) => [level, createBossProvenance({ source: 'legacy-unknown' })]));
  const written = [];
  if (!ensureCompanion(storage, STORAGE_KEYS.masteryEvidence, [], validEvidence, written)) {
    return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.masteryEvidence });
  }
  const evidenceRead = safeGet(storage, STORAGE_KEYS.masteryEvidence);
  if (!evidenceRead.ok) return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.masteryEvidence });
  const evidence = normalizeEvidenceLedger(parseStoredJson(evidenceRead.value, []));
  const additions = [
    [STORAGE_KEYS.masterySeenItems, buildMasterySeenIndex(evidence), isCanonicalMasterySeenIndex],
    [STORAGE_KEYS.miniGameScoresV2, normalizeScoreStore({ version: 2, legacy: { scores: legacyScores, medals: legacyMedals }, bestByScope: {} }), validScoreStore],
    [STORAGE_KEYS.bossProvenance, bossProvenance, validProvenance],
  ];
  for (const [key, value, validate] of additions) {
    if (!ensureCompanion(storage, key, value, validate, written)) return finish({ complete: false, writable: false, future: false, written, failedKey: key });
  }
  const seenRead = safeGet(storage, STORAGE_KEYS.masterySeenItems);
  if (!seenRead.ok) return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.masterySeenItems });
  const seenItems = normalizeMasterySeenIndex(parseStoredJson(seenRead.value, null));
  const expectedClaims = buildMasterySeenIndex(evidence).claims;
  const missingClaims = expectedClaims.filter((expected) => !seenItems.claims.some((claim) => claim.itemId === expected.itemId));
  const effectiveSeenItems = missingClaims.length
    ? { ...seenItems, claims: [...seenItems.claims, ...missingClaims] }
    : seenItems;
  if (missingClaims.length) {
    if (!safeWrite(storage, STORAGE_KEYS.masterySeenItems, effectiveSeenItems)) {
      return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.masterySeenItems });
    }
    if (!written.includes(STORAGE_KEYS.masterySeenItems)) written.push(STORAGE_KEYS.masterySeenItems);
  }
  const conflictingEvidence = evidence.find((attempt) => attempt.events.length
    && attempt.eligibility === 'prospective'
    && !effectiveSeenItems.claims.some((claim) => claim.itemId === attempt.itemId && claim.attemptId === attempt.attemptId));
  if (conflictingEvidence) {
    return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.masterySeenItems });
  }
  if (markerVersion === CURRENT_STATE_SCHEMA_VERSION) return finish({ complete: true, writable: true, future: false, written, failedKey: null });

  const markerValue = { version: CURRENT_STATE_SCHEMA_VERSION, migratedAt: String(now) };
  if (!safeWrite(storage, STORAGE_KEYS.stateSchema, markerValue)) {
    return finish({ complete: false, writable: false, future: false, written, failedKey: STORAGE_KEYS.stateSchema });
  }
  if (markerRead.value === null) written.push(STORAGE_KEYS.stateSchema);
  return finish({ complete: true, writable: true, future: false, written, failedKey: null });
};
