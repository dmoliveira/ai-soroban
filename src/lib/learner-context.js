import {
  STORAGE_KEYS,
  normalizePlacementState,
  parseStoredJson,
  storageWritesAllowed,
} from './storage.js';

export const LEARNER_PATHS = Object.freeze({
  children: Object.freeze({ id: 'children', label: 'Children', title: 'Children Path' }),
  adults: Object.freeze({ id: 'adults', label: 'Adults', title: 'Adult Path' }),
});

const validPathIds = new Set(Object.keys(LEARNER_PATHS));

export const normalizeLearnerPath = (value) => {
  if (typeof value !== 'string') return null;
  if (validPathIds.has(value)) return value;
  const parsed = parseStoredJson(value, null);
  return typeof parsed === 'string' && validPathIds.has(parsed) ? parsed : null;
};

export const learnerPathLabel = (path) => LEARNER_PATHS[normalizeLearnerPath(path)]?.label || null;

export const readLearnerPath = (storage) => {
  try {
    return normalizeLearnerPath(storage?.getItem?.(STORAGE_KEYS.path));
  } catch {
    return null;
  }
};

export const writeLearnerPath = (storage, path) => {
  const normalized = normalizeLearnerPath(path);
  if (!normalized || !storageWritesAllowed(storage) || typeof storage?.setItem !== 'function') return false;
  try {
    storage.setItem(STORAGE_KEYS.path, normalized);
    return typeof storage.getItem !== 'function' || storage.getItem(STORAGE_KEYS.path) === normalized;
  } catch {
    return false;
  }
};

export const retainLearnerPathForNavigation = (storage, path, { writable = true } = {}) => {
  const requested = normalizeLearnerPath(path);
  const previous = readLearnerPath(storage);
  if (!requested) return { requested: null, previous, path: previous, outcome: 'failed' };
  if (previous === requested) return { requested, previous, path: previous, outcome: 'retained' };
  const saved = writable && writeLearnerPath(storage, requested);
  const actual = readLearnerPath(storage);
  return {
    requested,
    previous,
    path: actual,
    outcome: saved && actual === requested ? 'saved' : 'failed',
  };
};

export const clearLearnerPath = (storage) => {
  if (!storageWritesAllowed(storage) || typeof storage?.removeItem !== 'function') return false;
  try {
    storage.removeItem(STORAGE_KEYS.path);
    return typeof storage.getItem !== 'function' || storage.getItem(STORAGE_KEYS.path) === null;
  } catch {
    return false;
  }
};

export const normalizeStartingPoint = (value) => {
  const valid = value
    && typeof value === 'object'
    && !Array.isArray(value)
    && /^L[0-5]$/.test(value.level)
    && typeof value.title === 'string'
    && value.title.trim()
    && typeof value.reason === 'string'
    && value.reason.trim();
  return valid ? value : null;
};

export const readLearnerContext = (storage) => {
  let placement = { choice: null, answers: {} };
  try {
    placement = normalizePlacementState(parseStoredJson(storage?.getItem?.(STORAGE_KEYS.placementResult), null));
  } catch {}
  return {
    path: readLearnerPath(storage),
    startingPoint: normalizeStartingPoint(placement.choice),
  };
};
