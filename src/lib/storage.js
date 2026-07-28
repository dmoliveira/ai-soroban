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
]);

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

export const writeStoredJson = (storage, key, value) => {
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
  PROGRESS_STORAGE_KEYS.forEach((key) => storage?.removeItem(key));
};
