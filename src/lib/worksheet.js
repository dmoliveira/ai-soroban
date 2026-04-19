export const DIGIT_RANGE_OPTIONS = ['2-2', '2-3', '3-4', '4-4'];
export const OPERATION_RANGE_OPTIONS = ['2-3', '3-4', '4-6', '2-10'];
export const OPERATOR_MODE_OPTIONS = ['add', 'subtract', 'mixed'];

export const parseRangeValue = (value, fallback) => {
  const matched = String(value || '').match(/^(\d+)-(\d+)$/);
  if (!matched) return fallback;
  const min = Number(matched[1]);
  const max = Number(matched[2]);
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) return fallback;
  return { min, max };
};

export const digitCount = (value) => String(Math.abs(Number(value))).length;

export const createWorksheetProfile = ({ digitRange = '2-3', operationRange = '2-3', operatorMode = 'mixed' } = {}) => {
  const digits = parseRangeValue(digitRange, { min: 2, max: 3 });
  const operations = parseRangeValue(operationRange, { min: 2, max: 3 });
  const mode = OPERATOR_MODE_OPTIONS.includes(operatorMode) ? operatorMode : 'mixed';
  return {
    id: `${digits.min}-${digits.max}:${operations.min}-${operations.max}:${mode}`,
    digitRange: `${digits.min}-${digits.max}`,
    operationRange: `${operations.min}-${operations.max}`,
    minDigits: digits.min,
    maxDigits: digits.max,
    minOperations: operations.min,
    maxOperations: operations.max,
    operatorMode: mode,
    label: `${digits.min}-${digits.max} digits · ${operations.min}-${operations.max} ops · ${mode}`,
  };
};

export const buildWorksheetProfileLabel = (profile) => profile?.label || '';

export const certifyWorksheetProfile = (profile) => {
  const errors = [];
  if (!profile) return { valid: false, errors: ['missing worksheet profile'] };
  if (profile.minDigits < 2 || profile.maxDigits > 4) errors.push('digit range must stay within 2-4 digits in v1');
  if (profile.minDigits > profile.maxDigits) errors.push('digit range must be ordered');
  if (profile.minOperations < 2 || profile.maxOperations > 10) errors.push('operation range must stay within 2-10 in v1');
  if (profile.minOperations > profile.maxOperations) errors.push('operation range must be ordered');
  if (!OPERATOR_MODE_OPTIONS.includes(profile.operatorMode)) errors.push('operator mode must be add, subtract, or mixed');
  return { valid: errors.length === 0, errors };
};

const hash = (value) => Array.from(String(value)).reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);

export const createRng = (seed) => {
  let state = Math.abs(hash(seed)) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const numberForDigits = (rng, minDigits, maxDigits) => {
  const digits = randInt(rng, minDigits, maxDigits);
  const lower = 10 ** (digits - 1);
  const upper = (10 ** digits) - 1;
  return randInt(rng, lower, upper);
};

const operatorsForMode = (rng, count, mode) => {
  if (mode === 'add') return Array.from({ length: count }, () => '+');
  if (mode === 'subtract') return Array.from({ length: count }, () => '-');
  const operators = Array.from({ length: count }, () => (rng() > 0.5 ? '+' : '-'));
  if (count > 1 && !operators.includes('+')) operators[0] = '+';
  if (count > 1 && !operators.includes('-')) operators[count - 1] = '-';
  return operators;
};

const buildSubtractTerms = (rng, profile, operationCount) => {
  const minValue = 10 ** (profile.minDigits - 1);
  const maxValue = (10 ** profile.maxDigits) - 1;
  const feasibleMaxOperations = Math.floor(maxValue / minValue);

  if (operationCount > feasibleMaxOperations) {
    throw new Error(`subtract mode supports at most ${feasibleMaxOperations} operations for ${profile.label} without going negative`);
  }

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const start = numberForDigits(rng, profile.minDigits, profile.maxDigits);
    let remainingBudget = start;
    const terms = [{ operator: null, value: start }];
    let valid = true;

    for (let index = 0; index < operationCount; index += 1) {
      const remainingFutureOps = operationCount - index - 1;
      const maxAllowed = Math.min(maxValue, remainingBudget - (remainingFutureOps * minValue));
      if (maxAllowed < minValue) {
        valid = false;
        break;
      }
      const value = randInt(rng, minValue, maxAllowed);
      terms.push({ operator: '-', value });
      remainingBudget -= value;
    }

    if (valid && evaluateWorksheetTerms(terms) >= 0) return terms;
  }

  throw new Error(`Unable to generate subtract worksheet for profile ${profile.label}`);
};

export const evaluateWorksheetTerms = (terms) => terms.slice(1).reduce((total, term) => (
  term.operator === '-' ? total - term.value : total + term.value
), terms[0]?.value || 0);

export const certifyWorksheetDrill = (profile, terms) => {
  const errors = [];
  if (!profile) errors.push('missing profile');
  if (!Array.isArray(terms) || terms.length < 2) errors.push('worksheet drill needs a start value and at least one operation');
  if (errors.length) return { valid: false, errors };

  const profileCertification = certifyWorksheetProfile(profile);
  if (!profileCertification.valid) errors.push(...profileCertification.errors);

  const operationCount = terms.length - 1;
  if (operationCount < profile.minOperations || operationCount > profile.maxOperations) {
    errors.push(`expected ${profile.minOperations}-${profile.maxOperations} operations, got ${operationCount}`);
  }

  terms.forEach((term, index) => {
    if (!Number.isInteger(term.value)) errors.push(`term ${index} must be an integer`);
    const digits = digitCount(term.value);
    if (digits < profile.minDigits || digits > profile.maxDigits) {
      errors.push(`term ${index} must be ${profile.minDigits}-${profile.maxDigits} digits, got ${digits}`);
    }
    if (index === 0) {
      if (term.operator !== null && term.operator !== undefined) errors.push('first term must not have an operator');
      return;
    }
    if (!['+', '-'].includes(term.operator)) errors.push(`term ${index} must use + or -`);
    if (profile.operatorMode === 'add' && term.operator !== '+') errors.push(`term ${index} must use + for add mode`);
    if (profile.operatorMode === 'subtract' && term.operator !== '-') errors.push(`term ${index} must use - for subtract mode`);
  });

  return { valid: errors.length === 0, errors };
};

export const certifyWorksheetContentData = (data) => {
  if (!data?.worksheetProfile && !data?.worksheetDrill) return { valid: true, errors: [] };
  if (!data?.worksheetProfile || !data?.worksheetDrill) {
    return { valid: false, errors: ['worksheetProfile and worksheetDrill must exist together'] };
  }

  const profile = createWorksheetProfile(data.worksheetProfile);
  const errors = [];
  const drillCertification = certifyWorksheetDrill(profile, data.worksheetDrill.map((term, index) => ({
    operator: index === 0 ? null : term.operator,
    value: term.value,
  })));

  if (!drillCertification.valid) errors.push(...drillCertification.errors);
  if (data.worksheetProfile.label && data.worksheetProfile.label !== profile.label) {
    errors.push(`worksheetProfile label must match normalized label '${profile.label}'`);
  }

  return { valid: errors.length === 0, errors };
};

export const buildWorksheetPrompt = (terms) => terms.map((term, index) => (
  index === 0 ? `${term.value}` : `${term.operator} ${term.value}`
)).join('\n');

export const buildWorksheetSteps = (terms) => {
  const steps = [`Start from ${terms[0].value}.`];
  let total = terms[0].value;
  terms.slice(1).forEach((term) => {
    total = term.operator === '-' ? total - term.value : total + term.value;
    steps.push(`${term.operator === '-' ? 'Subtract' : 'Add'} ${term.value}. Total becomes ${total}.`);
  });
  steps.push(`Final answer: ${total}.`);
  return steps;
};

export const generateWorksheetQuestion = ({ profile, rng, index, level = 'L3' }) => {
  const profileCertification = certifyWorksheetProfile(profile);
  if (!profileCertification.valid) {
    throw new Error(`Worksheet profile is out of supported bounds: ${profileCertification.errors.join('; ')}`);
  }

  const minValue = 10 ** (profile.minDigits - 1);
  const maxValue = (10 ** profile.maxDigits) - 1;
  const feasibleMaxOperations = profile.operatorMode === 'subtract'
    ? Math.min(profile.maxOperations, Math.floor(maxValue / minValue))
    : profile.maxOperations;

  if (feasibleMaxOperations < profile.minOperations) {
    throw new Error(`Worksheet profile is not feasible for ${profile.operatorMode} mode: ${profile.label}`);
  }

  const operationCount = randInt(rng, profile.minOperations, feasibleMaxOperations);
  const terms = profile.operatorMode === 'subtract'
    ? buildSubtractTerms(rng, profile, operationCount)
    : [{ operator: null, value: numberForDigits(rng, profile.minDigits, profile.maxDigits) }];

  if (profile.operatorMode !== 'subtract') {
    const operators = operatorsForMode(rng, operationCount, profile.operatorMode);
    operators.forEach((operator) => {
      terms.push({ operator, value: numberForDigits(rng, profile.minDigits, profile.maxDigits) });
    });
  }

  const certification = certifyWorksheetDrill(profile, terms);
  if (!certification.valid) {
    throw new Error(`Generated worksheet drill failed certification: ${certification.errors.join('; ')}`);
  }

  const answer = evaluateWorksheetTerms(terms);
  return {
    id: `g-${level}-${index}`,
    title: `${level} worksheet ${index + 1}`,
    prompt: 'Work the full sequence before checking your answer.',
    promptLines: buildWorksheetPrompt(terms).split('\n'),
    answer,
    visualValue: answer >= 0 ? answer : null,
    steps: buildWorksheetSteps(terms),
    worksheetTerms: terms,
    worksheetProfile: profile,
  };
};

export const buildGeneratedWorksheetQuestions = ({ level = 'L3', length = 10, sessionId, profile }) => {
  const rng = createRng(`${sessionId}:${profile.id}`);
  return Array.from({ length }, (_, index) => generateWorksheetQuestion({ profile, rng, index, level }));
};
