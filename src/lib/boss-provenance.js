export const BOSS_PROVENANCE_VERSION = 1;
export const BOSS_PROVENANCE_SOURCES = Object.freeze(['playable', 'manual', 'legacy-unknown']);

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const isCertificateDate = (value) => typeof value === 'string'
  && (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/.test(value));

export const isBossComplete = (value) => value === true;

export const normalizeBossCompletionRecord = (value) => Object.fromEntries(
  Object.entries(isRecord(value) ? value : {}).filter(([, completed]) => isBossComplete(completed)),
);

export const normalizeBossCertificateRecord = (value) => Object.fromEntries(
  Object.entries(isRecord(value) ? value : {}).flatMap(([level, entry]) => {
    if (!isRecord(entry)
      || typeof entry.name !== 'string'
      || !entry.name.trim()
      || !isCertificateDate(entry.date)) return [];
    return [[level, {
      name: entry.name.trim(),
      date: entry.date,
      source: BOSS_PROVENANCE_SOURCES.includes(entry.source) ? entry.source : null,
    }]];
  }),
);

export const createBossProvenance = ({ source, completedAt = null, ruleVersion = null, evidenceId = null }) => {
  if (!BOSS_PROVENANCE_SOURCES.includes(source)) throw new Error('Unsupported boss provenance source.');
  const completed = typeof completedAt === 'string' && Number.isFinite(Date.parse(completedAt)) ? completedAt : null;
  const normalizedRuleVersion = Number.isInteger(Number(ruleVersion)) && Number(ruleVersion) > 0 ? Number(ruleVersion) : null;
  if ((source === 'playable' || source === 'manual') && !completed) throw new Error('Current boss provenance requires a completion time.');
  if (source === 'playable' && !normalizedRuleVersion) throw new Error('Playable boss provenance requires a rule version.');
  return {
    version: BOSS_PROVENANCE_VERSION,
    source,
    completedAt: completed,
    ruleVersion: normalizedRuleVersion,
    evidenceId: evidenceId ? String(evidenceId) : null,
  };
};

export const normalizeBossProvenanceRecord = (value) => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([level, entry]) => {
    if (!isRecord(entry) || entry.version !== BOSS_PROVENANCE_VERSION || !BOSS_PROVENANCE_SOURCES.includes(entry.source)) return [];
    try {
      return [[level, createBossProvenance(entry)]];
    } catch {
      return [];
    }
  }));
};

export const isCanonicalBossProvenanceRecord = (value) => isRecord(value)
  && Object.entries(value).every(([, entry]) => {
    if (!hasExactKeys(entry, ['version', 'source', 'completedAt', 'ruleVersion', 'evidenceId'])) return false;
    try {
      const normalized = createBossProvenance(entry);
      return entry.version === normalized.version
        && entry.source === normalized.source
        && entry.completedAt === normalized.completedAt
        && entry.ruleVersion === normalized.ruleVersion
        && entry.evidenceId === normalized.evidenceId;
    } catch {
      return false;
    }
  });

export const resolveBossProvenance = (completed, entry) => {
  if (!completed) return null;
  const normalized = normalizeBossProvenanceRecord({ current: entry }).current;
  return normalized || createBossProvenance({ source: 'legacy-unknown' });
};

export const bossProvenanceLabel = (entry) => ({
  playable: 'Playable Dojo clear',
  manual: 'Offline self-recorded clear',
  'legacy-unknown': 'Legacy clear (source unknown)',
})[entry?.source] || 'Completion source unavailable';
