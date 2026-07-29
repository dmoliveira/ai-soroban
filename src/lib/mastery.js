export const MASTERY_EVIDENCE_VERSION = 1;
export const MASTERY_SEEN_INDEX_VERSION = 1;
export const DEFAULT_EVIDENCE_LIMIT = 400;

const SOURCES = new Set(['exercise', 'practice', 'worksheet', 'challenge', 'game', 'boss']);
const ELIGIBILITY = new Set(['prospective', 'activity-only']);
const EVENT_KINDS = new Set(['submit', 'hint', 'reveal-final', 'reveal-steps', 'recovery', 'manual']);
const ASSISTANCE_KINDS = new Set(['hint', 'reveal-final', 'reveal-steps', 'recovery', 'manual']);

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const isTimestamp = (value) => typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
const finiteVersion = (value, fallback = 1) => Number.isInteger(Number(value)) && Number(value) > 0
  ? Number(value)
  : fallback;

const normalizeRule = (rule) => ({
  id: String(rule?.id || 'unknown-rule'),
  version: finiteVersion(rule?.version),
});

const normalizeEvent = (event, index) => {
  if (!isRecord(event) || !EVENT_KINDS.has(event.kind)) return null;
  const normalized = {
    seq: Number.isInteger(event.seq) && event.seq > 0 ? event.seq : index + 1,
    kind: event.kind,
    at: typeof event.at === 'string' && event.at ? event.at : new Date().toISOString(),
  };
  if (event.kind === 'submit') {
    normalized.value = typeof event.value === 'string' ? event.value : String(event.value ?? '');
    normalized.correct = event.correct === true;
  }
  return normalized;
};

export const isCanonicalAttemptEvidence = (value) => {
  if (!hasExactKeys(value, ['version', 'attemptId', 'source', 'itemId', 'skill', 'level', 'rule', 'eligibility', 'seed', 'startedAt', 'events'])
    || value.version !== MASTERY_EVIDENCE_VERSION
    || typeof value.attemptId !== 'string'
    || !value.attemptId
    || typeof value.itemId !== 'string'
    || !value.itemId
    || !SOURCES.has(value.source)
    || typeof value.skill !== 'string'
    || typeof value.level !== 'string'
    || !hasExactKeys(value.rule, ['id', 'version'])
    || typeof value.rule.id !== 'string'
    || !value.rule.id
    || !Number.isInteger(value.rule.version)
    || value.rule.version < 1
    || !ELIGIBILITY.has(value.eligibility)
    || (value.seed !== null && typeof value.seed !== 'string')
    || !isTimestamp(value.startedAt)
    || !Array.isArray(value.events)) return false;
  return value.events.every((event, index) => {
    const eventKeys = event?.kind === 'submit'
      ? ['seq', 'kind', 'at', 'value', 'correct']
      : ['seq', 'kind', 'at'];
    if (!hasExactKeys(event, eventKeys)
      || event.seq !== index + 1
      || !EVENT_KINDS.has(event.kind)
      || !isTimestamp(event.at)) return false;
    return event.kind !== 'submit'
      || (typeof event.value === 'string' && typeof event.correct === 'boolean');
  });
};

export const createAttemptEvidence = ({
  attemptId,
  source,
  itemId,
  skill = 'unknown',
  level = 'unknown',
  rule,
  seed = null,
  startedAt = new Date().toISOString(),
  eligibility = 'prospective',
}) => {
  if (!attemptId || !itemId || !SOURCES.has(source)) {
    throw new Error('Attempt evidence requires a stable id, item, and supported source.');
  }
  return {
    version: MASTERY_EVIDENCE_VERSION,
    attemptId: String(attemptId),
    source,
    itemId: String(itemId),
    skill: String(skill || 'unknown'),
    level: String(level || 'unknown'),
    rule: normalizeRule(rule),
    eligibility: ELIGIBILITY.has(eligibility) ? eligibility : 'activity-only',
    seed: seed === null || seed === undefined ? null : String(seed),
    startedAt: String(startedAt),
    events: [],
  };
};

export const normalizeAttemptEvidence = (value) => {
  if (!isRecord(value) || value.version !== MASTERY_EVIDENCE_VERSION) return null;
  if (!value.attemptId || !value.itemId || !SOURCES.has(value.source)) return null;
  const canonical = isCanonicalAttemptEvidence(value);
  const events = Array.isArray(value.events)
    ? value.events.map(normalizeEvent).filter(Boolean).map((event, index) => ({ ...event, seq: index + 1 }))
    : [];
  return {
    version: MASTERY_EVIDENCE_VERSION,
    attemptId: String(value.attemptId),
    source: value.source,
    itemId: String(value.itemId),
    skill: String(value.skill || 'unknown'),
    level: String(value.level || 'unknown'),
    rule: normalizeRule(value.rule),
    eligibility: canonical && ELIGIBILITY.has(value.eligibility) ? value.eligibility : 'activity-only',
    seed: value.seed === null || value.seed === undefined ? null : String(value.seed),
    startedAt: typeof value.startedAt === 'string' && value.startedAt ? value.startedAt : '',
    events,
  };
};

export const isCanonicalMasterySeenIndex = (value) => {
  if (!hasExactKeys(value, ['version', 'claims']) || value.version !== MASTERY_SEEN_INDEX_VERSION || !Array.isArray(value.claims)) return false;
  const items = new Set();
  return value.claims.every((claim) => {
    if (!hasExactKeys(claim, ['itemId', 'attemptId', 'firstSeenAt'])
      || typeof claim.itemId !== 'string'
      || !claim.itemId
      || typeof claim.attemptId !== 'string'
      || !claim.attemptId
      || !isTimestamp(claim.firstSeenAt)
      || items.has(claim.itemId)) return false;
    items.add(claim.itemId);
    return true;
  });
};

export const normalizeMasterySeenIndex = (value) => {
  const claims = [];
  const items = new Set();
  if (isRecord(value) && Array.isArray(value.claims)) {
    value.claims.forEach((claim) => {
      if (!isRecord(claim)
        || typeof claim.itemId !== 'string'
        || !claim.itemId
        || typeof claim.attemptId !== 'string'
        || !claim.attemptId
        || !isTimestamp(claim.firstSeenAt)
        || items.has(claim.itemId)) return;
      items.add(claim.itemId);
      claims.push({ itemId: claim.itemId, attemptId: claim.attemptId, firstSeenAt: claim.firstSeenAt });
    });
  }
  return { version: MASTERY_SEEN_INDEX_VERSION, claims };
};

export const buildMasterySeenIndex = (ledger) => {
  const index = { version: MASTERY_SEEN_INDEX_VERSION, claims: [] };
  normalizeEvidenceLedger(ledger).forEach((attempt) => {
    if (!attempt.events.length || index.claims.some((claim) => claim.itemId === attempt.itemId)) return;
    index.claims.push({
      itemId: attempt.itemId,
      attemptId: attempt.attemptId,
      firstSeenAt: attempt.events[0]?.at || attempt.startedAt,
    });
  });
  return index;
};

export const claimMasteryItem = (value, { itemId, attemptId, firstSeenAt = new Date().toISOString() }) => {
  const index = normalizeMasterySeenIndex(value);
  const normalizedItemId = String(itemId || '');
  const normalizedAttemptId = String(attemptId || '');
  if (!normalizedItemId || !normalizedAttemptId) return { index, eligible: false, changed: false };
  const existing = index.claims.find((claim) => claim.itemId === normalizedItemId);
  if (existing) return { index, eligible: existing.attemptId === normalizedAttemptId, changed: false };
  const claim = {
    itemId: normalizedItemId,
    attemptId: normalizedAttemptId,
    firstSeenAt: isTimestamp(firstSeenAt) ? firstSeenAt : new Date().toISOString(),
  };
  return { index: { ...index, claims: [...index.claims, claim] }, eligible: true, changed: true };
};

export const masteryClaimOwnedBy = (value, itemId, attemptId) => normalizeMasterySeenIndex(value).claims
  .some((claim) => claim.itemId === String(itemId) && claim.attemptId === String(attemptId));

export const appendEvidenceEvent = (attempt, event) => {
  const normalized = normalizeAttemptEvidence(attempt);
  if (!normalized) throw new Error('Cannot append an event to invalid attempt evidence.');
  const nextEvent = normalizeEvent(event, normalized.events.length);
  if (!nextEvent) throw new Error('Unsupported evidence event.');
  return {
    ...normalized,
    events: [...normalized.events, { ...nextEvent, seq: normalized.events.length + 1 }],
  };
};

export const summarizeAttemptEvidence = (attempt) => {
  const normalized = normalizeAttemptEvidence(attempt);
  if (!normalized) {
    return { valid: false, qualified: false, firstCheckCorrect: false, finalCorrect: false, assisted: false, checks: 0, assistance: [] };
  }
  const submits = normalized.events.filter((event) => event.kind === 'submit');
  const firstSubmit = submits[0] || null;
  const assistance = normalized.events
    .filter((event) => (!firstSubmit || event.seq < firstSubmit.seq) && ASSISTANCE_KINDS.has(event.kind))
    .map((event) => event.kind)
    .filter((kind, index, values) => values.indexOf(kind) === index);
  const assisted = assistance.length > 0;
  return {
    valid: true,
    qualified: normalized.eligibility === 'prospective' && Boolean(firstSubmit?.value.trim()) && !assisted,
    firstCheckCorrect: firstSubmit?.correct === true,
    finalCorrect: submits.at(-1)?.correct === true,
    assisted,
    checks: submits.length,
    assistance,
  };
};

export const normalizeEvidenceLedger = (value, limit = DEFAULT_EVIDENCE_LIMIT) => (
  Array.isArray(value)
    ? value.map(normalizeAttemptEvidence).filter(Boolean).slice(-Math.max(1, Number(limit) || DEFAULT_EVIDENCE_LIMIT))
    : []
);

export const upsertAttemptEvidence = (ledger, attempt, limit = DEFAULT_EVIDENCE_LIMIT) => {
  const current = normalizeEvidenceLedger(ledger, limit);
  let normalized = normalizeAttemptEvidence(attempt);
  if (!normalized) return current;
  const priorExposure = current.some((entry) => entry.attemptId !== normalized.attemptId
    && entry.itemId === normalized.itemId
    && entry.events.length > 0);
  if (priorExposure) normalized = { ...normalized, eligibility: 'activity-only' };
  const existing = current.find((entry) => entry.attemptId === normalized.attemptId);
  const withoutExisting = current.filter((entry) => entry.attemptId !== normalized.attemptId);
  if (!existing) return [...withoutExisting, normalized].slice(-Math.max(1, Number(limit) || DEFAULT_EVIDENCE_LIMIT));

  const signature = (event) => JSON.stringify([event.kind, event.at, event.value ?? null, event.correct ?? null]);
  const existingSignatures = existing.events.map(signature);
  const incomingSignatures = normalized.events.map(signature);
  const existingIsPrefix = existingSignatures.every((value, index) => incomingSignatures[index] === value);
  const incomingIsPrefix = incomingSignatures.every((value, index) => existingSignatures[index] === value);
  let merged;
  if (existingIsPrefix) merged = normalized;
  else if (incomingIsPrefix) merged = existing;
  else {
    const events = [...existing.events, ...normalized.events]
      .filter((event, index, values) => values.findIndex((candidate) => signature(candidate) === signature(event)) === index)
      .sort((left, right) => String(left.at).localeCompare(String(right.at)))
      .map((event, index) => ({ ...event, seq: index + 1 }));
    merged = { ...normalized, eligibility: 'activity-only', events };
  }
  if (existing.eligibility === 'activity-only' || normalized.eligibility === 'activity-only') {
    merged = { ...merged, eligibility: 'activity-only' };
  }
  return [...withoutExisting, merged].slice(-Math.max(1, Number(limit) || DEFAULT_EVIDENCE_LIMIT));
};
