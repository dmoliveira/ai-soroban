export const SOROBAN_STATE_VERSION = 1;

const assertDigit = (digit) => {
  const numeric = Number(digit);
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 9) throw new Error('Invalid soroban digit.');
  return numeric;
};

export const normalizeRodState = (state) => {
  const lowerActive = Number(state?.lowerActive);
  if (typeof state?.upperActive !== 'boolean' || !Number.isInteger(lowerActive) || lowerActive < 0 || lowerActive > 4) {
    throw new Error('Invalid 1:4 soroban rod state.');
  }
  return { upperActive: state.upperActive, lowerActive };
};

export const digitToRodState = (digit) => {
  const numeric = assertDigit(digit);
  return { upperActive: numeric >= 5, lowerActive: numeric % 5 };
};

export const rodStateToDigit = (state) => {
  const normalized = normalizeRodState(state);
  return (normalized.upperActive ? 5 : 0) + normalized.lowerActive;
};

export const toggleUpperBead = (state) => {
  const normalized = normalizeRodState(state);
  return { ...normalized, upperActive: !normalized.upperActive };
};

export const pressLowerBead = (state, beadIndex) => {
  const normalized = normalizeRodState(state);
  const index = Number(beadIndex);
  if (!Number.isInteger(index) || index < 1 || index > 4) throw new Error('Lower bead index must be 1 through 4.');
  return { ...normalized, lowerActive: index <= normalized.lowerActive ? index - 1 : index };
};

export const numberToSorobanState = (value) => {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 0) throw new Error('Soroban values must be non-negative integers.');
  return {
    version: SOROBAN_STATE_VERSION,
    rods: String(numeric).split('').map((digit) => digitToRodState(Number(digit))),
  };
};

export const sorobanStateToNumber = (state) => {
  if (state?.version !== SOROBAN_STATE_VERSION || !Array.isArray(state.rods) || state.rods.length === 0) {
    throw new Error('Invalid soroban state.');
  }
  return Number(state.rods.map(rodStateToDigit).join(''));
};

export const normalizeStepTimeline = (stepValues, finalValue) => {
  const final = Number(finalValue);
  if (!Number.isInteger(final) || final < 0) throw new Error('Final soroban value must be a non-negative integer.');
  const timeline = (Array.isArray(stepValues) ? stepValues : [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0)
    .filter((value, index, values) => index === 0 || value !== values[index - 1]);
  if (timeline.at(-1) !== final) timeline.push(final);
  return timeline.length ? timeline : [final];
};
