export const STORAGE_KEYS = Object.freeze({
  path: 'soroban-dojo:path',
  completedLessons: 'soroban-dojo:completed-lessons',
  exerciseStates: 'soroban-dojo:exercise-states',
  timerHistory: 'soroban-dojo:timer-history',
  practiceSessions: 'soroban-dojo:practice-sessions',
  worksheetSessions: 'soroban-dojo:worksheet-sessions',
  weeklyStudyPlan: 'soroban-dojo:weekly-study-plan',
  placementResult: 'soroban-dojo:placement-result',
  miniGameScores: 'soroban-dojo:minigame-scores',
  miniGameMedals: 'soroban-dojo:minigame-medals',
  bossRounds: 'soroban-dojo:boss-rounds',
  bossSessionProgress: 'soroban-dojo:boss-session-progress',
  bossCertificates: 'soroban-dojo:boss-certificates',
  stateSchema: 'soroban-dojo:state-schema',
  masteryEvidence: 'soroban-dojo:mastery-evidence-v1',
  masterySeenItems: 'soroban-dojo:mastery-seen-items-v1',
  miniGameScoresV2: 'soroban-dojo:minigame-scores-v2',
  bossProvenance: 'soroban-dojo:boss-provenance-v1',
  resetEpoch: 'soroban-dojo:reset-epoch',
  theme: 'soroban-dojo:theme',
});

export const PROGRESS_STORAGE_KEYS = Object.freeze([
  STORAGE_KEYS.path,
  STORAGE_KEYS.completedLessons,
  STORAGE_KEYS.exerciseStates,
  STORAGE_KEYS.timerHistory,
  STORAGE_KEYS.practiceSessions,
  STORAGE_KEYS.worksheetSessions,
  STORAGE_KEYS.weeklyStudyPlan,
  STORAGE_KEYS.placementResult,
  STORAGE_KEYS.miniGameScores,
  STORAGE_KEYS.miniGameMedals,
  STORAGE_KEYS.bossRounds,
  STORAGE_KEYS.bossSessionProgress,
  STORAGE_KEYS.bossCertificates,
  STORAGE_KEYS.masteryEvidence,
  STORAGE_KEYS.masterySeenItems,
  STORAGE_KEYS.miniGameScoresV2,
  STORAGE_KEYS.bossProvenance,
]);

const compatibilityByStorage = new WeakMap();

export const setStorageCompatibility = (storage, result) => {
  if (storage && (typeof storage === 'object' || typeof storage === 'function')) {
    compatibilityByStorage.set(storage, result);
  }
  return result;
};

export const storageWritesAllowed = (storage) => compatibilityByStorage.get(storage)?.writable !== false;

export const parseStoredJson = (rawValue, fallback) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') return fallback;
  try {
    return JSON.parse(rawValue);
  } catch {
    return fallback;
  }
};

export const readStoredJson = (storage, key, fallback) => (
  parseStoredJson(storage?.getItem(key), fallback)
);

export const normalizeStoredArray = (value) => Array.isArray(value) ? value : [];

export const normalizeStoredRecord = (value) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : {}
);

export const readStoredArray = (storage, key) => normalizeStoredArray(readStoredJson(storage, key, []));

export const readStoredRecord = (storage, key) => normalizeStoredRecord(readStoredJson(storage, key, {}));

export const writeStoredJson = (storage, key, value) => {
  if (!storageWritesAllowed(storage)) return false;
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const normalizePlacementState = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { choice: null, answers: {} };
  }

  if ('choice' in value || 'answers' in value) {
    const choice = value.choice && typeof value.choice === 'object' ? value.choice : null;
    const answers = value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers)
      ? value.answers
      : {};
    return { choice, answers };
  }

  const isLegacyChoice = typeof value.level === 'string'
    && typeof value.title === 'string'
    && typeof value.reason === 'string';
  return { choice: isLegacyChoice ? value : null, answers: {} };
};

export const firstIncompletePlanStep = (state) => (
  ['lesson', 'exercise', 'worksheet'].find((step) => !state?.[step]?.done) || null
);

export const clearProgressStorage = (storage) => {
  const failedKeys = [];
  PROGRESS_STORAGE_KEYS.forEach((key) => {
    try {
      storage?.removeItem(key);
    } catch {
      failedKeys.push(key);
    }
  });
  let broadcast = false;
  if (failedKeys.length === 0) {
    try {
      storage?.setItem?.(STORAGE_KEYS.resetEpoch, `${Date.now()}:${Math.random().toString(36).slice(2)}`);
      broadcast = true;
    } catch {}
  }
  return { complete: failedKeys.length === 0, failedKeys, broadcast };
};
