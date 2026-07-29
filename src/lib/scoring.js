export const SCORE_SUMMARY_VERSION = 2;
export const NORMALIZED_MEDAL_THRESHOLDS = Object.freeze({ bronze: 60, silver: 80, gold: 95 });

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const finiteNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const clampInteger = (value, min, max) => Math.min(max, Math.max(min, Math.round(finiteNumber(value))));
const normalizeScopeSettings = (value) => Object.fromEntries(Object.entries(isRecord(value) ? value : {})
  .filter(([, setting]) => ['string', 'number', 'boolean'].includes(typeof setting) && Number.isFinite(typeof setting === 'number' ? setting : 0))
  .sort(([left], [right]) => left.localeCompare(right)));

export const scoreScopeKey = (scope) => JSON.stringify({
  mode: scope.mode,
  tier: scope.tier || 'starter',
  ruleVersion: scope.ruleVersion,
  settings: normalizeScopeSettings(scope?.settings),
});

export const medalForNormalizedScore = (score) => {
  const normalized = clampInteger(score, 0, 100);
  if (normalized >= NORMALIZED_MEDAL_THRESHOLDS.gold) return 'gold';
  if (normalized >= NORMALIZED_MEDAL_THRESHOLDS.silver) return 'silver';
  if (normalized >= NORMALIZED_MEDAL_THRESHOLDS.bronze) return 'bronze';
  return 'starter';
};

export const buildScoreSummary = ({
  mode,
  tier = 'starter',
  ruleVersion = 1,
  settings = {},
  rawPoints = 0,
  correct = 0,
  answered = 0,
  total = 0,
  assisted = 0,
  completedNaturally = false,
  completedAt = null,
}) => {
  if (!/^[a-z0-9-]+$/.test(String(mode || ''))
    || !/^[a-z0-9-]+$/.test(String(tier || ''))
    || !Number.isInteger(Number(ruleVersion))
    || Number(ruleVersion) < 1) {
    throw new Error('A comparable score requires a mode and positive rule version.');
  }
  const normalizedTotal = Math.max(0, Math.round(finiteNumber(total)));
  const normalizedAnswered = clampInteger(answered, 0, normalizedTotal);
  const normalizedCorrect = clampInteger(correct, 0, normalizedAnswered);
  const normalizedAssisted = clampInteger(assisted, 0, normalizedCorrect);
  return {
    version: SCORE_SUMMARY_VERSION,
    scope: { mode: String(mode), tier: String(tier || 'starter'), ruleVersion: Number(ruleVersion), settings: normalizeScopeSettings(settings) },
    rawPoints: Math.max(0, Math.round(finiteNumber(rawPoints))),
    normalized: normalizedTotal ? Math.round((normalizedCorrect / normalizedTotal) * 100) : 0,
    correct: normalizedCorrect,
    answered: normalizedAnswered,
    total: normalizedTotal,
    assisted: normalizedAssisted,
    completedNaturally: completedNaturally === true,
    completedAt: typeof completedAt === 'string' && Number.isFinite(Date.parse(completedAt)) ? completedAt : null,
  };
};

const normalizeSummary = (value) => {
  if (!isRecord(value) || value.version !== SCORE_SUMMARY_VERSION || !isRecord(value.scope)) return null;
  try {
    return buildScoreSummary({ ...value, ...value.scope });
  } catch {
    return null;
  }
};

export const isCanonicalScoreSummary = (value) => {
  const normalized = normalizeSummary(value);
  if (!normalized
    || !hasExactKeys(value, ['version', 'scope', 'rawPoints', 'normalized', 'correct', 'answered', 'total', 'assisted', 'completedNaturally', 'completedAt'])
    || !hasExactKeys(value.scope, ['mode', 'tier', 'ruleVersion', 'settings'])
    || !isRecord(value.scope.settings)) return false;
  return value.version === normalized.version
    && JSON.stringify(value.scope) === JSON.stringify(normalized.scope)
    && value.rawPoints === normalized.rawPoints
    && value.normalized === normalized.normalized
    && value.correct === normalized.correct
    && value.answered === normalized.answered
    && value.total === normalized.total
    && value.assisted === normalized.assisted
    && value.completedNaturally === normalized.completedNaturally
    && value.completedAt === normalized.completedAt;
};

export const isCanonicalScoreStore = (value) => hasExactKeys(value, ['version', 'legacy', 'bestByScope'])
  && value.version === SCORE_SUMMARY_VERSION
  && hasExactKeys(value.legacy, ['scores', 'medals'])
  && isRecord(value.legacy.scores)
  && isRecord(value.legacy.medals)
  && isRecord(value.bestByScope)
  && Object.entries(value.bestByScope).every(([key, summary]) => (
    isCanonicalScoreSummary(summary) && key === scoreScopeKey(summary.scope)
  ));

export const normalizeScoreStore = (value) => {
  const legacy = isRecord(value?.legacy) ? value.legacy : {};
  const legacyScores = isRecord(legacy.scores) ? { ...legacy.scores } : {};
  const legacyMedals = isRecord(legacy.medals) ? { ...legacy.medals } : {};
  const bestByScope = {};
  if (isRecord(value?.bestByScope)) {
    Object.entries(value.bestByScope).forEach(([key, summary]) => {
      const normalized = normalizeSummary(summary);
      if (normalized && key === scoreScopeKey(normalized.scope)) bestByScope[key] = normalized;
    });
  }
  return { version: SCORE_SUMMARY_VERSION, legacy: { scores: legacyScores, medals: legacyMedals }, bestByScope };
};

export const storeComparableScore = (store, summary) => {
  const normalizedStore = normalizeScoreStore(store);
  const normalizedSummary = normalizeSummary(summary);
  if (!normalizedSummary?.completedNaturally) return normalizedStore;
  const key = scoreScopeKey(normalizedSummary.scope);
  const existing = normalizedStore.bestByScope[key];
  if (existing && existing.normalized > normalizedSummary.normalized) return normalizedStore;
  return {
    ...normalizedStore,
    bestByScope: { ...normalizedStore.bestByScope, [key]: normalizedSummary },
  };
};
