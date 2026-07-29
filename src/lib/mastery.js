export const MASTERY_EVIDENCE_VERSION = 1;
export const MASTERY_SEEN_INDEX_VERSION = 1;
export const DEFAULT_EVIDENCE_LIMIT = 400;
export const REVIEW_BUCKET_ORDER = Object.freeze(['mental', 'division', 'multiplication', 'complements', 'arithmetic']);

const SOURCES = new Set(['exercise', 'practice', 'worksheet', 'challenge', 'game', 'boss']);
const ELIGIBILITY = new Set(['prospective', 'activity-only']);
const EVENT_KINDS = new Set(['submit', 'hint', 'reveal-final', 'reveal-steps', 'recovery', 'manual']);
const ASSISTANCE_KINDS = new Set(['hint', 'reveal-final', 'reveal-steps', 'recovery', 'manual']);
const REVIEW_SKILLS = new Set([
  'abacus-orientation', 'number-reading', 'place-value', 'number-setting', 'addition', 'subtraction',
  'complements', 'mixed-operations', 'multiplication', 'division', 'anzan', 'mastery',
]);

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

export const reviewBucketForSignal = ({ skill, level, sessionId } = {}) => {
  const normalizedSkill = typeof skill === 'string' ? skill.trim().toLowerCase() : '';
  const normalizedLevel = typeof level === 'string' ? level.trim().toUpperCase() : '';
  const normalizedSessionId = typeof sessionId === 'string' ? sessionId.toUpperCase() : '';
  if (normalizedSkill === 'anzan' || normalizedSkill === 'mastery' || normalizedLevel === 'L5' || normalizedSessionId.includes('L5')) return 'mental';
  if (normalizedSkill === 'division') return 'division';
  if (normalizedSkill === 'multiplication' || normalizedLevel === 'L4' || normalizedSessionId.includes('L4')) return 'multiplication';
  if (normalizedSkill === 'complements' || normalizedLevel === 'L2' || normalizedSessionId.includes('L2')) return 'complements';
  return 'arithmetic';
};

const emptyReviewBuckets = () => Object.fromEntries(REVIEW_BUCKET_ORDER.map((key) => [key, {
  evidenceCount: 0,
  activityCount: 0,
  unresolvedItemIds: [],
  legacyItemIds: [],
}]));

const selectReviewBucket = (buckets, field) => REVIEW_BUCKET_ORDER
  .reduce((selected, key) => buckets[key][field] > buckets[selected][field] ? key : selected, REVIEW_BUCKET_ORDER[0]);

export const deriveReviewProfile = ({ evidenceLedger, seenIndex, activityStates } = {}) => {
  const normalizedLedger = normalizeEvidenceLedger(evidenceLedger);
  const canonicalLedger = normalizedLedger.filter(isCanonicalAttemptEvidence);
  const claimIndexValid = isCanonicalMasterySeenIndex(seenIndex);
  const claims = claimIndexValid ? seenIndex.claims : [];
  const attemptsById = new Map();
  const duplicateAttemptIds = new Set();
  canonicalLedger.forEach((attempt) => {
    if (attemptsById.has(attempt.attemptId)) duplicateAttemptIds.add(attempt.attemptId);
    attemptsById.set(attempt.attemptId, attempt);
  });

  let missingClaimDetails = 0;
  const ownedQualified = [];
  const qualifiedItemIds = new Set();
  const claimedAttemptIds = new Set(claims.map((claim) => claim.attemptId));
  claims.forEach((claim, claimIndex) => {
    const attempt = attemptsById.get(claim.attemptId);
    const ownsExactDetail = attempt
      && !duplicateAttemptIds.has(claim.attemptId)
      && attempt.itemId === claim.itemId;
    if (!ownsExactDetail) {
      missingClaimDetails += 1;
      return;
    }
    const summary = summarizeAttemptEvidence(attempt);
    const skill = typeof attempt.skill === 'string' ? attempt.skill.trim().toLowerCase() : '';
    if (!summary.qualified || !REVIEW_SKILLS.has(skill)) return;
    qualifiedItemIds.add(attempt.itemId);
    ownedQualified.push({ attempt, summary, skill, claimIndex });
  });

  const unownedProspectiveDetails = canonicalLedger.filter((attempt) => attempt.eligibility === 'prospective'
    && attempt.events.length > 0
    && !claimedAttemptIds.has(attempt.attemptId)).length;
  const claimIndexIncomplete = !claimIndexValid && canonicalLedger.some((attempt) => attempt.events.length > 0);
  const historyIncomplete = claimIndexIncomplete || missingClaimDetails > 0;
  const unresolvedMisses = [];
  if (historyIncomplete) {
    ownedQualified.forEach((record) => {
      if (!record.summary.firstCheckCorrect) unresolvedMisses.push(record);
    });
  } else {
    const unresolvedBySkill = new Map();
    ownedQualified.forEach((record) => {
      const queue = unresolvedBySkill.get(record.skill) || [];
      if (!record.summary.firstCheckCorrect) {
        queue.push(record);
        unresolvedBySkill.set(record.skill, queue);
        return;
      }
      const missIndex = queue.findIndex((candidate) => candidate.attempt.itemId !== record.attempt.itemId);
      if (missIndex >= 0) queue.splice(missIndex, 1);
      unresolvedBySkill.set(record.skill, queue);
    });
    unresolvedBySkill.forEach((queue) => unresolvedMisses.push(...queue));
    unresolvedMisses.sort((left, right) => left.claimIndex - right.claimIndex);
  }

  const buckets = emptyReviewBuckets();
  unresolvedMisses.forEach(({ attempt }) => {
    const key = reviewBucketForSignal(attempt);
    buckets[key].evidenceCount += 1;
    buckets[key].unresolvedItemIds.push(attempt.itemId);
  });

  if (isRecord(activityStates)) {
    Object.entries(activityStates).forEach(([itemId, entry]) => {
      if (!isRecord(entry) || entry.status !== 'needs-review' || qualifiedItemIds.has(itemId)) return;
      const key = reviewBucketForSignal(entry);
      buckets[key].activityCount += 1;
      buckets[key].legacyItemIds.push(itemId);
    });
  }

  const evidenceTotal = REVIEW_BUCKET_ORDER.reduce((sum, key) => sum + buckets[key].evidenceCount, 0);
  const activityTotal = REVIEW_BUCKET_ORDER.reduce((sum, key) => sum + buckets[key].activityCount, 0);
  const basis = evidenceTotal > 0 ? 'first-check' : activityTotal > 0 ? 'activity' : 'none';
  const field = basis === 'first-check' ? 'evidenceCount' : 'activityCount';
  const focusKey = basis === 'none' ? null : selectReviewBucket(buckets, field);
  const focus = focusKey ? {
    key: focusKey,
    basis,
    count: buckets[focusKey][field],
    evidenceCount: buckets[focusKey].evidenceCount,
    activityCount: buckets[focusKey].activityCount,
  } : null;

  return {
    basis,
    focus,
    total: basis === 'first-check' ? evidenceTotal : activityTotal,
    evidenceTotal,
    activityTotal,
    retainedQualifiedCount: ownedQualified.length,
    historyIncomplete,
    missingClaimDetails,
    unownedProspectiveDetails,
    buckets,
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
