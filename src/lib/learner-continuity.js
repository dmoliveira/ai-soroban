import { canonicalizeChallengeSession } from './challenges.js';
import { learnerPathLabel, normalizeLearnerPath, normalizeStartingPoint, readLearnerContext } from './learner-context.js';
import { STORAGE_KEYS, firstIncompletePlanStep, normalizeStoredArray, normalizeStoredRecord, readStoredJson } from './storage.js';

export const CONTINUITY_PROFILES = Object.freeze({
  L0: Object.freeze({ level: 'L0', title: 'Foundations', skill: 'abacus-orientation', skillLabel: 'soroban foundations', lesson: 'lessons/l0/parts-of-the-soroban', worksheetPreset: 'foundations-focus', worksheetSubmode: 'arithmetic-rhythm' }),
  L1: Object.freeze({ level: 'L1', title: 'Beginner', skill: 'addition', skillLabel: 'one-rod addition', lesson: 'lessons/l1/first-addition-on-one-rod', worksheetPreset: 'one-rod-focus', worksheetSubmode: 'arithmetic-rhythm' }),
  L2: Object.freeze({ level: 'L2', title: 'Basic Operations', skill: 'complements', skillLabel: 'five and ten complements', lesson: 'lessons/l2/complements-to-ten', worksheetPreset: 'complements', worksheetSubmode: 'complement-balance' }),
  L3: Object.freeze({ level: 'L3', title: 'Intermediate', skill: 'mixed-operations', skillLabel: 'mixed-operation rhythm', lesson: 'lessons/l3/mixed-two-digit-fluency', worksheetPreset: 'mixed-fluency', worksheetSubmode: 'arithmetic-rhythm' }),
  L4: Object.freeze({ level: 'L4', title: 'Advanced', skill: 'multiplication', skillLabel: 'multiplication structure', lesson: 'lessons/l4/first-multiplication-patterns', worksheetPreset: 'multiplication-focus', worksheetSubmode: 'place-shifts' }),
  L5: Object.freeze({ level: 'L5', title: 'Mastery', skill: 'anzan', skillLabel: 'mental recall', lesson: 'lessons/l5/mental-soroban-sequences', worksheetPreset: 'anzan-focus', worksheetSubmode: 'anzan-recall' }),
});

export const SKILL_TARGETS = Object.freeze({
  'abacus-orientation': CONTINUITY_PROFILES.L0,
  'number-reading': Object.freeze({ ...CONTINUITY_PROFILES.L0, skill: 'number-reading', skillLabel: 'number reading' }),
  'place-value': Object.freeze({ ...CONTINUITY_PROFILES.L0, skill: 'place-value', skillLabel: 'place value' }),
  'number-setting': Object.freeze({ ...CONTINUITY_PROFILES.L1, skill: 'number-setting', skillLabel: 'number setting', lesson: 'lessons/l1/setting-first-numbers' }),
  addition: CONTINUITY_PROFILES.L1,
  subtraction: Object.freeze({ ...CONTINUITY_PROFILES.L1, skill: 'subtraction', skillLabel: 'one-rod subtraction' }),
  complements: CONTINUITY_PROFILES.L2,
  'mixed-operations': CONTINUITY_PROFILES.L3,
  multiplication: CONTINUITY_PROFILES.L4,
  division: Object.freeze({ ...CONTINUITY_PROFILES.L4, skill: 'division', skillLabel: 'quotient building', lesson: 'lessons/l4/building-quotients-in-division', worksheetPreset: 'division-focus', worksheetSubmode: 'quotient-building' }),
  anzan: CONTINUITY_PROFILES.L5,
  mastery: Object.freeze({ ...CONTINUITY_PROFILES.L5, skill: 'mastery', skillLabel: 'mental mastery' }),
});

export const WORKSHEET_SUBMODE_TARGETS = Object.freeze({
  'arithmetic-rhythm': Object.freeze({ preset: 'mixed-fluency', compatiblePresets: Object.freeze(['foundations-focus', 'one-rod-focus', 'practice', 'mixed-fluency']), submode: 'arithmetic-rhythm' }),
  'complement-balance': Object.freeze({ preset: 'complements', compatiblePresets: Object.freeze(['complements']), submode: 'complement-balance' }),
  'sequence-signs': Object.freeze({ preset: 'sequence-mix', compatiblePresets: Object.freeze(['sequence-mix']), submode: 'sequence-signs' }),
  'table-family': Object.freeze({ preset: 'multiplication-focus', compatiblePresets: Object.freeze(['multiplication-focus']), submode: 'table-family' }),
  'place-shifts': Object.freeze({ preset: 'multiplication-focus', compatiblePresets: Object.freeze(['multiplication-focus']), submode: 'place-shifts' }),
  'division-facts': Object.freeze({ preset: 'division-focus', compatiblePresets: Object.freeze(['division-focus']), submode: 'division-facts' }),
  'quotient-building': Object.freeze({ preset: 'division-focus', compatiblePresets: Object.freeze(['division-focus']), submode: 'quotient-building' }),
  'anzan-recall': Object.freeze({ preset: 'anzan-focus', compatiblePresets: Object.freeze(['anzan-focus']), submode: 'anzan-recall' }),
});

const validPresets = new Set([
  'warmup', 'foundations-focus', 'one-rod-focus', 'practice', 'mixed-fluency', 'review', 'speed', 'exam',
  'multiplication-focus', 'division-focus', 'anzan-focus', 'carry', 'borrow', 'complements', 'sequence-mix',
]);
const validSessionId = (value) => typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,160}$/.test(value);
const validLevel = (value) => typeof value === 'string' && /^L[0-5]$/.test(value);
const profileForLevel = (level) => CONTINUITY_PROFILES[validLevel(level) ? level : ''] || null;
export const targetForSkill = (skill, level = null) => SKILL_TARGETS[typeof skill === 'string' ? skill : ''] || profileForLevel(level);

const validPracticeQuestion = (question) => question
  && typeof question === 'object'
  && !Array.isArray(question)
  && typeof question.id === 'string'
  && question.id.length > 0
  && typeof question.title === 'string'
  && typeof question.prompt === 'string'
  && Number.isFinite(question.answer)
  && Array.isArray(question.steps)
  && question.steps.every((step) => typeof step === 'string');

export const normalizeResumablePracticeSession = (entry) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const canonical = canonicalizeChallengeSession({ ...entry, responses: normalizeStoredRecord(entry.responses) });
  const valid = canonical
    && canonical.completed === false
    && canonical.challengeUnavailable !== true
    && validSessionId(canonical.id)
    && validLevel(canonical.level)
    && Array.isArray(canonical.questions)
    && canonical.questions.length > 0
    && canonical.questions.every(validPracticeQuestion)
    && Number.isInteger(canonical.currentIndex)
    && canonical.currentIndex >= 0
    && canonical.currentIndex < canonical.questions.length;
  return valid ? canonical : null;
};

const isUsableWeeklyPlan = (plan) => typeof plan?.planId === 'string'
  && typeof plan?.lesson?.id === 'string'
  && typeof plan?.lesson?.done === 'boolean'
  && typeof plan?.exercise?.id === 'string'
  && typeof plan?.exercise?.done === 'boolean'
  && typeof plan?.worksheet?.href === 'string'
  && typeof plan?.worksheet?.done === 'boolean';

export const buildFocusedPracticeHref = (level, skill, { start = true } = {}) => {
  const target = targetForSkill(skill, level);
  if (!target) return 'practice';
  const params = new URLSearchParams({ level: target.level, skill: target.skill });
  if (start) params.set('start', '1');
  return `practice?${params.toString()}`;
};

export const buildFocusedWorksheetHref = (skill, level = null) => {
  const target = targetForSkill(skill, level) || CONTINUITY_PROFILES.L0;
  return `worksheets?preset=${target.worksheetPreset}&submode=${target.worksheetSubmode}`;
};

export const resolveWorksheetTarget = ({ preset, submode } = {}) => {
  const requestedSubmode = typeof submode === 'string' ? WORKSHEET_SUBMODE_TARGETS[submode] : null;
  if (requestedSubmode) {
    const compatiblePreset = typeof preset === 'string' && requestedSubmode.compatiblePresets.includes(preset)
      ? preset
      : requestedSubmode.preset;
    return Object.freeze({ preset: compatiblePreset, submode: requestedSubmode.submode });
  }
  const requestedPreset = typeof preset === 'string' && validPresets.has(preset) ? preset : 'foundations-focus';
  return Object.freeze({ preset: requestedPreset, submode: null });
};

export const toBaseHref = (base, href) => {
  const safeBase = typeof base === 'string' && base.startsWith('/')
    ? (base.endsWith('/') ? base : `${base}/`)
    : '/soroban-dojo/';
  return typeof href === 'string' && !href.startsWith('/') && !href.includes('://') ? `${safeBase}${href}` : safeBase;
};

const safeRead = (reader, fallback) => {
  try { return reader(); } catch { return fallback; }
};

export const deriveReviewFocus = (exerciseStates) => {
  const counts = { arithmetic: 0, complements: 0, multiplication: 0, division: 0, mental: 0 };
  Object.values(normalizeStoredRecord(exerciseStates)).forEach((entry) => {
    if (entry?.status !== 'needs-review') return;
    const skill = entry.skill || '';
    if (skill === 'division') counts.division += 1;
    else if (skill === 'multiplication') counts.multiplication += 1;
    else if (skill === 'complements') counts.complements += 1;
    else if (skill === 'anzan' || skill === 'mastery') counts.mental += 1;
    else counts.arithmetic += 1;
  });
  if (Object.values(counts).every((count) => count === 0)) return null;
  const key = ['mental', 'division', 'multiplication', 'complements', 'arithmetic']
    .sort((left, right) => counts[right] - counts[left])[0];
  const skillByFocus = { mental: 'anzan', division: 'division', multiplication: 'multiplication', complements: 'complements', arithmetic: 'mixed-operations' };
  return { key, count: counts[key], skill: skillByFocus[key], target: SKILL_TARGETS[skillByFocus[key]] };
};

export const deriveContinuityKey = ({ context, exerciseStates }) => {
  const review = deriveReviewFocus(exerciseStates);
  if (review) return `review:${review.key}`;
  const startingPoint = normalizeStartingPoint(context?.startingPoint);
  if (startingPoint) return `placement:${startingPoint.level}`;
  const path = normalizeLearnerPath(context?.path);
  return path ? `path:${path}` : 'default';
};

export const readContinuitySnapshot = (storage) => {
  const context = safeRead(() => readLearnerContext(storage), { path: null, startingPoint: null });
  const completedLessons = safeRead(() => normalizeStoredArray(readStoredJson(storage, STORAGE_KEYS.completedLessons, [])), [])
    .filter((entry) => typeof entry === 'string');
  const exerciseStates = safeRead(() => normalizeStoredRecord(readStoredJson(storage, STORAGE_KEYS.exerciseStates, {})), {});
  const practiceSessions = safeRead(() => normalizeStoredArray(readStoredJson(storage, STORAGE_KEYS.practiceSessions, [])), [])
    .filter((entry) => entry && typeof entry === 'object' && !Array.isArray(entry));
  const weeklyPlan = safeRead(() => normalizeStoredRecord(readStoredJson(storage, STORAGE_KEYS.weeklyStudyPlan, {})), {});
  const continuityKey = deriveContinuityKey({ context, exerciseStates });
  return { context, completedLessons, exerciseStates, practiceSessions, weeklyPlan, continuityKey };
};

const contextLabels = (context) => {
  const labels = [];
  const path = normalizeLearnerPath(context?.path);
  const startingPoint = normalizeStartingPoint(context?.startingPoint);
  if (path) labels.push(`${learnerPathLabel(path)} route`);
  if (startingPoint) labels.push(`${startingPoint.level} ${startingPoint.title}`);
  return labels;
};

const recommendation = (kind, title, copy, primary, secondary, context) => ({
  kind,
  title,
  copy,
  primary,
  secondary,
  contextLabels: contextLabels(context),
});

export const buildContinuityRecommendation = (snapshot) => {
  const context = snapshot?.context || { path: null, startingPoint: null };
  const completedLessons = normalizeStoredArray(snapshot?.completedLessons);
  const exerciseStates = normalizeStoredRecord(snapshot?.exerciseStates);
  const sessions = normalizeStoredArray(snapshot?.practiceSessions);
  const continuityKey = snapshot?.continuityKey || deriveContinuityKey({ context, exerciseStates });
  const resumable = sessions.map(normalizeResumablePracticeSession).find(Boolean);
  if (resumable) {
    return recommendation('resume', `Resume your saved ${resumable.level} session`, 'Continue the exact unfinished question list instead of opening a second practice thread.',
      { href: `practice?resume=${encodeURIComponent(resumable.id)}`, label: 'Resume saved session' },
      { href: 'practice', label: 'Open practice setup' }, context);
  }

  const review = deriveReviewFocus(exerciseStates);
  if (review) {
    return recommendation('review', `Repair ${review.target.skillLabel} next`, `${review.count} saved review item${review.count === 1 ? '' : 's'} point to this focused practice area.`,
      { href: buildFocusedPracticeHref(review.target.level, review.target.skill), label: `Start ${review.target.skillLabel} practice` },
      { href: buildFocusedWorksheetHref(review.target.skill, review.target.level), label: 'Open matching worksheet' }, context);
  }

  const weeklyPlan = normalizeStoredRecord(snapshot?.weeklyPlan);
  const weeklyStep = weeklyPlan.continuityKey === continuityKey && isUsableWeeklyPlan(weeklyPlan)
    ? firstIncompletePlanStep(weeklyPlan)
    : null;
  if (weeklyStep) {
    return recommendation('weekly-plan', `Continue your weekly ${weeklyStep} step`, 'This saved step still matches the route, placement, and review context currently in this browser.',
      { href: 'study-plan', label: `Open ${weeklyStep} step` },
      { href: 'progress', label: 'Review progress' }, context);
  }

  const startingPoint = normalizeStartingPoint(context.startingPoint);
  if (startingPoint) {
    const profile = profileForLevel(startingPoint.level) || CONTINUITY_PROFILES.L0;
    return recommendation('placement', completedLessons.length ? `Keep training from ${startingPoint.level} ${startingPoint.title}` : `Start from ${startingPoint.level} ${startingPoint.title}`,
      `${startingPoint.reason} ${completedLessons.length ? 'Use one focused session to continue from that starting point.' : 'Read the matched lesson before starting one focused session.'}`,
      completedLessons.length
        ? { href: buildFocusedPracticeHref(profile.level, profile.skill), label: `Start ${profile.skillLabel} practice` }
        : { href: profile.lesson, label: 'Open matched lesson' },
      { href: completedLessons.length ? buildFocusedWorksheetHref(profile.skill, profile.level) : buildFocusedPracticeHref(profile.level, profile.skill), label: completedLessons.length ? 'Open matched worksheet' : 'Start focused practice' }, context);
  }

  const path = normalizeLearnerPath(context.path);
  if (path) {
    if (completedLessons.length === 0) {
      const children = path === 'children';
      return recommendation('route', `Continue the ${learnerPathLabel(path).toLowerCase()} route`, children
        ? 'Keep the first session visual and short: one foundations lesson, then one calm attempt.'
        : 'Use a structured first lesson, then continue into one direct practice block.',
        { href: 'lessons/l0/parts-of-the-soroban', label: 'Open first lesson' },
        { href: `paths/${path}`, label: `Review ${learnerPathLabel(path).toLowerCase()} route` }, context);
    }
    return recommendation('route-progress', `Continue with the ${learnerPathLabel(path).toLowerCase()} route`, 'Your route is saved; use the weekly plan to choose one next lesson, exercise, or worksheet.',
      { href: 'study-plan', label: 'Open weekly plan' },
      { href: `paths/${path}`, label: 'Review route' }, context);
  }

  const recent = sessions.find((entry) => entry?.completed === true && validLevel(entry.level));
  if (recent) {
    const target = targetForSkill(recent.skill, recent.level) || CONTINUITY_PROFILES.L0;
    return recommendation('recent-practice', `Repeat ${target.skillLabel} while it is fresh`, 'A short follow-up session keeps the most recent completed practice connected to the next step.',
      { href: buildFocusedPracticeHref(target.level, target.skill), label: 'Repeat focused practice' },
      { href: buildFocusedWorksheetHref(target.skill, target.level), label: 'Use matching worksheet' }, context);
  }

  return recommendation('setup', 'Choose a calm starting context', 'Select a learner route or take the placement self-check before opening broad practice.',
    { href: 'start-here', label: 'Choose a learner route' },
    { href: 'assessments', label: 'Take placement self-check' }, context);
};
