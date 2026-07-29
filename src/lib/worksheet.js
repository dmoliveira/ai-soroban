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

export const WORKSHEET_FAMILY_RULE_VERSION = 1;
export const WORKSHEET_CERTIFIED_FAMILIES = Object.freeze(['additive', 'complement', 'multiplication', 'division', 'anzan']);
export const WORKSHEET_SOURCE_FAMILIES = Object.freeze(['addition', 'subtraction', 'mixed', 'sequence', 'multiplication', 'division', 'anzan']);
export const WORKSHEET_FAMILY_SUBMODES = Object.freeze([
  'auto',
  'arithmetic-rhythm',
  'complement-balance',
  'sequence-signs',
  'table-family',
  'place-shifts',
  'division-facts',
  'quotient-building',
  'anzan-recall',
]);

const WORKSHEET_FAMILY_MODES = new Set(['fixed', 'dynamic', 'adaptive']);
const WORKSHEET_FAMILY_FLOWS = new Set(['balanced', 'ramp']);
const WORKSHEET_FAMILY_QUESTION_KEYS = ['id', 'index', 'level', 'family', 'sourceFamily', 'submode', 'rule', 'operands', 'technique', 'answer'];
const WORKSHEET_FAMILY_OPERAND_KEYS = ['role', 'operator', 'value'];
const WORKSHEET_FAMILY_RULE_KEYS = ['id', 'version'];
const WORKSHEET_COMPLEMENT_KEYS = ['moveIndex', 'kind'];
const ADDITIVE_SOURCE_FAMILIES = new Set(['addition', 'subtraction', 'mixed', 'sequence']);

const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);
const hasExactKeys = (value, keys) => isRecord(value)
  && Object.keys(value).length === keys.length
  && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
const hashId = (value) => (hash(value) >>> 0).toString(36);
const isLevel = (value) => /^L[0-5]$/.test(String(value || ''));
const valueBoundsForBand = ({ min, max }) => ({
  min: min === 1 ? 1 : 10 ** (min - 1),
  max: (10 ** max) - 1,
});
const randomValueForBand = (rng, band) => {
  const digits = randInt(rng, band.min, band.max);
  const lower = digits === 1 ? 1 : 10 ** (digits - 1);
  return randInt(rng, lower, (10 ** digits) - 1);
};

export const parseWorksheetFamilyBand = (value) => {
  const matched = String(value || '').match(/^(\d)(?:-(\d))?$/);
  if (!matched) throw new Error('Worksheet family digit band must be a single digit or ordered range.');
  const min = Number(matched[1]);
  const max = Number(matched[2] || matched[1]);
  if (min < 1 || max > 6 || min > max) throw new Error('Worksheet family digit band must stay within 1-6 digits.');
  return { min, max, id: min === max ? String(min) : `${min}-${max}` };
};

export const createWorksheetFamilyConfig = ({
  ruleVersion = WORKSHEET_FAMILY_RULE_VERSION,
  seed,
  count = 40,
  level = 'L0',
  sourceFamilies = ['addition'],
  submode = 'auto',
  digitBand = '2-3',
  minOperations = 1,
  maxOperations = 3,
  flowMode = 'balanced',
  mode = 'dynamic',
} = {}) => {
  if (ruleVersion !== WORKSHEET_FAMILY_RULE_VERSION) throw new Error(`Unsupported worksheet family rule version: ${ruleVersion}`);
  if (typeof seed !== 'string' || !seed) throw new Error('Worksheet family generation requires a non-empty seed.');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Worksheet family count must be an integer from 1-100.');
  if (!isLevel(level)) throw new Error('Worksheet family level must be L0-L5.');
  if (!Array.isArray(sourceFamilies)) throw new Error('Worksheet source families must be an array.');
  const normalizedSources = [...new Set(sourceFamilies.length ? sourceFamilies : ['addition'])];
  if (normalizedSources.some((family) => !WORKSHEET_SOURCE_FAMILIES.includes(family))) {
    throw new Error('Worksheet source families contain an unsupported family.');
  }
  if (!WORKSHEET_FAMILY_SUBMODES.includes(submode)) throw new Error(`Unsupported worksheet submode: ${submode}`);
  if (!Number.isInteger(minOperations) || !Number.isInteger(maxOperations)) {
    throw new Error('Worksheet operation bounds must be integers.');
  }
  const normalizedMinOperations = Math.min(minOperations, maxOperations);
  const normalizedMaxOperations = Math.max(minOperations, maxOperations);
  if (normalizedMinOperations < 1 || normalizedMaxOperations > 4) {
    throw new Error('Worksheet operation bounds must stay within 1-4.');
  }
  if (!WORKSHEET_FAMILY_FLOWS.has(flowMode)) throw new Error(`Unsupported worksheet flow: ${flowMode}`);
  if (!WORKSHEET_FAMILY_MODES.has(mode)) throw new Error(`Unsupported worksheet mode: ${mode}`);
  const band = parseWorksheetFamilyBand(digitBand);
  return {
    ruleVersion: WORKSHEET_FAMILY_RULE_VERSION,
    seed,
    count,
    level,
    sourceFamilies: normalizedSources,
    submode,
    digitBand: band.id,
    minDigits: band.min,
    maxDigits: band.max,
    minOperations: normalizedMinOperations,
    maxOperations: normalizedMaxOperations,
    flowMode,
    mode,
  };
};

const worksheetFamilyConfigIdentity = (config) => JSON.stringify([
  config.ruleVersion,
  config.seed,
  config.count,
  config.level,
  config.sourceFamilies,
  config.submode,
  config.digitBand,
  config.minOperations,
  config.maxOperations,
  config.flowMode,
  config.mode,
]);

export const worksheetFamilyBandForIndex = (config, index) => {
  const overall = { min: config.minDigits, max: config.maxDigits };
  if (config.flowMode !== 'ramp' || overall.min === overall.max) return overall;
  const progress = config.count <= 1 ? 1 : index / (config.count - 1);
  if (progress < 0.45) return { min: overall.min, max: Math.max(overall.min, overall.max - 1) };
  if (progress < 0.8) return { min: Math.max(overall.min, overall.max - 1), max: overall.max };
  return { min: overall.max, max: overall.max };
};

export const resolveWorksheetFamily = (sourceFamily, requestedSubmode = 'auto') => {
  if (sourceFamily === 'multiplication') {
    return {
      family: 'multiplication',
      submode: ['table-family', 'place-shifts'].includes(requestedSubmode) ? requestedSubmode : 'place-shifts',
    };
  }
  if (sourceFamily === 'division') {
    return {
      family: 'division',
      submode: ['division-facts', 'quotient-building'].includes(requestedSubmode) ? requestedSubmode : 'quotient-building',
    };
  }
  if (sourceFamily === 'anzan' || (sourceFamily === 'sequence' && requestedSubmode === 'anzan-recall')) {
    return { family: 'anzan', submode: 'anzan-recall' };
  }
  if (ADDITIVE_SOURCE_FAMILIES.has(sourceFamily) && requestedSubmode === 'complement-balance') {
    return { family: 'complement', submode: 'complement-balance' };
  }
  if (sourceFamily === 'sequence') return { family: 'additive', submode: 'sequence-signs' };
  return { family: 'additive', submode: 'arithmetic-rhythm' };
};

const effectiveOperationRange = (config, sourceFamily, family) => {
  if (family === 'multiplication' || family === 'division') return { min: 1, max: 1 };
  const familyMinimum = family === 'anzan' || sourceFamily === 'sequence' ? 2 : 1;
  const min = Math.max(config.minOperations, familyMinimum);
  return { min, max: Math.max(min, config.maxOperations) };
};

const operatorsForSourceFamily = (sourceFamily, count, variant) => {
  if (sourceFamily === 'addition') return Array.from({ length: count }, () => '+');
  if (sourceFamily === 'subtraction') return Array.from({ length: count }, () => '-');
  if (count === 1) return [variant % 2 === 0 ? '+' : '-'];
  const first = variant % 2 === 0 ? '+' : '-';
  return Array.from({ length: count }, (_, index) => (index % 2 === 0 ? first : first === '+' ? '-' : '+'));
};

const buildArithmeticOperands = ({ rng, band, operators, mental = false }) => {
  const bounds = valueBoundsForBand(band);
  const subtractionCount = operators.filter((operator) => operator === '-').length;
  const requiredStart = bounds.min * subtractionCount;
  if (requiredStart > bounds.max) return null;
  let total = randInt(rng, Math.max(bounds.min, requiredStart), bounds.max);
  const operands = [{ role: mental ? 'mental-start' : 'start', operator: null, value: total }];
  operators.forEach((operator, index) => {
    let value;
    if (operator === '+') {
      value = randomValueForBand(rng, band);
    } else {
      const remainingSubtractions = operators.slice(index + 1).filter((candidate) => candidate === '-').length;
      const maxAllowed = Math.min(bounds.max, total - (remainingSubtractions * bounds.min));
      if (maxAllowed < bounds.min) return;
      value = randInt(rng, bounds.min, maxAllowed);
    }
    total = operator === '-' ? total - value : total + value;
    operands.push({
      role: mental
        ? operator === '-' ? 'mental-subtrahend' : 'mental-addend'
        : operator === '-' ? 'subtrahend' : 'addend',
      operator,
      value,
    });
  });
  return operands.length === operators.length + 1 ? operands : null;
};

const complementTechniqueForMove = (before, operator, value) => {
  const beforeUnit = Math.abs(before) % 10;
  const valueUnit = Math.abs(value) % 10;
  if (operator === '+' && beforeUnit + valueUnit >= 10) return 'complement-10';
  if (operator === '-' && beforeUnit < valueUnit) return 'complement-10';
  if (operator === '+' && beforeUnit < 5 && beforeUnit + valueUnit >= 5 && beforeUnit + valueUnit < 10) return 'complement-5';
  if (operator === '-' && beforeUnit >= 5 && beforeUnit >= valueUnit && beforeUnit - valueUnit < 5) return 'complement-5';
  return null;
};

const findComplementTechnique = (operands) => {
  let total = operands[0].value;
  for (let index = 1; index < operands.length; index += 1) {
    const operand = operands[index];
    const kind = complementTechniqueForMove(total, operand.operator, operand.value);
    if (kind) return { moveIndex: index, kind };
    total = operand.operator === '-' ? total - operand.value : total + operand.value;
  }
  return null;
};

export const evaluateWorksheetFamilyOperands = (operands) => operands.slice(1).reduce((total, operand) => {
  if (operand.operator === '-') return total - operand.value;
  if (operand.operator === '×') return total * operand.value;
  if (operand.operator === '÷') return total / operand.value;
  return total + operand.value;
}, operands[0]?.value || 0);

export const formatWorksheetFamilyQuestion = (question) => question.operands.map((operand, index) => (
  index === 0 ? String(operand.value) : `${operand.operator} ${operand.value}`
)).join(' ');

const worksheetQuestionIdentity = (question) => JSON.stringify([
  question.index,
  question.level,
  question.family,
  question.sourceFamily,
  question.submode,
  isRecord(question.rule) ? [question.rule.id, question.rule.version] : null,
  Array.isArray(question.operands)
    ? question.operands.map((operand) => (isRecord(operand) ? [operand.role, operand.operator, operand.value] : null))
    : null,
  isRecord(question.technique) ? [question.technique.moveIndex, question.technique.kind] : null,
  question.answer,
]);

const worksheetQuestionId = (config, question) => (
  `wf-v1-${hashId(worksheetFamilyConfigIdentity(config))}-${question.index}-${hashId(worksheetQuestionIdentity(question))}`
);

const buildWorksheetFamilyQuestionCandidate = (config, index, attempt) => {
  const sourceFamily = config.sourceFamilies[index % config.sourceFamilies.length];
  const { family, submode } = resolveWorksheetFamily(sourceFamily, config.submode);
  const band = worksheetFamilyBandForIndex(config, index);
  const operationRange = effectiveOperationRange(config, sourceFamily, family);
  const operationCount = operationRange.min + (index % (operationRange.max - operationRange.min + 1));
  const rng = createRng(`${worksheetFamilyConfigIdentity(config)}:${index}:${attempt}`);
  let operands;
  let technique = null;

  if (family === 'multiplication') {
    operands = [
      { role: 'multiplicand', operator: null, value: randomValueForBand(rng, band) },
      { role: 'multiplier', operator: '×', value: randomValueForBand(rng, band) },
    ];
  } else if (family === 'division') {
    const bounds = valueBoundsForBand(band);
    for (let retry = 0; retry < 120 && !operands; retry += 1) {
      const divisor = randomValueForBand(rng, band);
      const maxQuotient = Math.floor(bounds.max / divisor);
      if (maxQuotient < 1) continue;
      const minimumQuotient = maxQuotient >= 2 ? 2 : 1;
      const quotient = randInt(rng, minimumQuotient, Math.min(maxQuotient, 12));
      const dividend = divisor * quotient;
      const digits = digitCount(dividend);
      if (digits < band.min || digits > band.max) continue;
      operands = [
        { role: 'dividend', operator: null, value: dividend },
        { role: 'divisor', operator: '÷', value: divisor },
      ];
    }
    if (!operands) return null;
  } else {
    const operators = operatorsForSourceFamily(sourceFamily, operationCount, index + attempt);
    operands = buildArithmeticOperands({ rng, band, operators, mental: family === 'anzan' });
    if (!operands) return null;
    if (family === 'complement') {
      technique = findComplementTechnique(operands);
      if (!technique) return null;
    }
  }

  const partial = {
    id: '',
    index,
    level: config.level,
    family,
    sourceFamily,
    submode,
    rule: { id: `worksheet.${family}`, version: WORKSHEET_FAMILY_RULE_VERSION },
    operands,
    technique,
    answer: evaluateWorksheetFamilyOperands(operands),
  };
  return { ...partial, id: worksheetQuestionId(config, partial) };
};

const certifyConfig = (input) => {
  try {
    return { config: createWorksheetFamilyConfig(input), errors: [] };
  } catch (error) {
    return { config: null, errors: [error instanceof Error ? error.message : String(error)] };
  }
};

export const certifyWorksheetFamilyQuestion = (question, configInput, expectedIndex = question?.index) => {
  const { config, errors } = certifyConfig(configInput);
  if (!config) return { valid: false, errors };
  if (!hasExactKeys(question, WORKSHEET_FAMILY_QUESTION_KEYS)) {
    return { valid: false, errors: [...errors, 'worksheet family question must use the exact v1 shape'] };
  }
  if (!Number.isInteger(expectedIndex) || expectedIndex < 0 || expectedIndex >= config.count) {
    return { valid: false, errors: [...errors, 'expected worksheet index is out of range'] };
  }
  if (question.index !== expectedIndex) errors.push(`worksheet question index must be ${expectedIndex}`);
  if (question.level !== config.level) errors.push(`worksheet question level must be ${config.level}`);
  const expectedSource = config.sourceFamilies[expectedIndex % config.sourceFamilies.length];
  const expectedResolution = resolveWorksheetFamily(expectedSource, config.submode);
  if (question.sourceFamily !== expectedSource) errors.push(`worksheet source family must be ${expectedSource}`);
  if (question.family !== expectedResolution.family) errors.push(`worksheet certified family must be ${expectedResolution.family}`);
  if (question.submode !== expectedResolution.submode) errors.push(`worksheet submode must be ${expectedResolution.submode}`);
  if (!hasExactKeys(question.rule, WORKSHEET_FAMILY_RULE_KEYS)
    || question.rule.id !== `worksheet.${expectedResolution.family}`
    || question.rule.version !== WORKSHEET_FAMILY_RULE_VERSION) {
    errors.push('worksheet rule must exactly match its certified family and numeric v1');
  }
  if (!Array.isArray(question.operands) || question.operands.length < 2) {
    errors.push('worksheet question needs at least two operands');
    return { valid: false, errors };
  }
  const band = worksheetFamilyBandForIndex(config, expectedIndex);
  let operandsHaveExactShape = true;
  let operandsHaveValidValues = true;
  question.operands.forEach((operand, operandIndex) => {
    if (!hasExactKeys(operand, WORKSHEET_FAMILY_OPERAND_KEYS)) {
      operandsHaveExactShape = false;
      errors.push(`worksheet operand ${operandIndex} must use the exact v1 shape`);
      return;
    }
    if (!Number.isSafeInteger(operand.value) || operand.value < 1) {
      operandsHaveValidValues = false;
      errors.push(`worksheet operand ${operandIndex} must be a positive safe integer`);
      return;
    }
    const digits = digitCount(operand.value);
    if (digits < band.min || digits > band.max) errors.push(`worksheet operand ${operandIndex} must stay inside the row digit band`);
  });
  if (!operandsHaveExactShape || !operandsHaveValidValues) return { valid: false, errors };

  const operationRange = effectiveOperationRange(config, expectedSource, expectedResolution.family);
  const operationCount = question.operands.length - 1;
  if (operationCount < operationRange.min || operationCount > operationRange.max) {
    errors.push(`worksheet operation count must be ${operationRange.min}-${operationRange.max}`);
  }

  const certifyArithmeticRoles = (mental = false) => {
    const firstRole = mental ? 'mental-start' : 'start';
    if (question.operands[0].role !== firstRole || question.operands[0].operator !== null) {
      errors.push(`worksheet first operand must be ${firstRole} without an operator`);
    }
    let total = question.operands[0].value;
    question.operands.slice(1).forEach((operand, index) => {
      if (!['+', '-'].includes(operand.operator)) errors.push(`worksheet operation ${index + 1} must use + or -`);
      const expectedRole = mental
        ? operand.operator === '-' ? 'mental-subtrahend' : 'mental-addend'
        : operand.operator === '-' ? 'subtrahend' : 'addend';
      if (operand.role !== expectedRole) errors.push(`worksheet operation ${index + 1} has the wrong role`);
      total = operand.operator === '-' ? total - operand.value : total + operand.value;
      if (total < 0) errors.push(`worksheet running total ${index + 1} must not be negative`);
    });
    const operators = question.operands.slice(1).map((operand) => operand.operator);
    if (expectedSource === 'addition' && operators.some((operator) => operator !== '+')) errors.push('addition source must use only +');
    if (expectedSource === 'subtraction' && operators.some((operator) => operator !== '-')) errors.push('subtraction source must use only -');
    if ((expectedSource === 'mixed' || expectedSource === 'sequence' || mental) && operationCount > 1) {
      if (!operators.includes('+') || !operators.includes('-')) errors.push('mixed, sequence, and anzan rows must include both signs when possible');
    }
  };

  if (expectedResolution.family === 'multiplication') {
    if (question.operands.length !== 2
      || question.operands[0].role !== 'multiplicand'
      || question.operands[0].operator !== null
      || question.operands[1].role !== 'multiplier'
      || question.operands[1].operator !== '×') errors.push('multiplication must use multiplicand × multiplier roles');
  } else if (expectedResolution.family === 'division') {
    if (question.operands.length !== 2
      || question.operands[0].role !== 'dividend'
      || question.operands[0].operator !== null
      || question.operands[1].role !== 'divisor'
      || question.operands[1].operator !== '÷') errors.push('division must use dividend ÷ divisor roles');
    if (question.operands[1]?.value === 0 || question.operands[0]?.value % question.operands[1]?.value !== 0) {
      errors.push('division must have a nonzero divisor and exact integer quotient');
    }
  } else {
    certifyArithmeticRoles(expectedResolution.family === 'anzan');
  }

  if (expectedResolution.family === 'complement') {
    if (!hasExactKeys(question.technique, WORKSHEET_COMPLEMENT_KEYS)
      || !Number.isInteger(question.technique.moveIndex)
      || question.technique.moveIndex < 1
      || question.technique.moveIndex >= question.operands.length
      || !['complement-5', 'complement-10'].includes(question.technique.kind)) {
      errors.push('complement worksheet requires an exact move index and complement kind');
    } else {
      const expectedTechnique = findComplementTechnique(question.operands);
      if (!expectedTechnique
        || expectedTechnique.moveIndex !== question.technique.moveIndex
        || expectedTechnique.kind !== question.technique.kind) errors.push('complement technique does not match the first certified prefix move');
    }
  } else if (question.technique !== null) {
    errors.push('non-complement worksheet techniques must be null');
  }

  const recomputedAnswer = evaluateWorksheetFamilyOperands(question.operands);
  if (!Number.isSafeInteger(question.answer) || question.answer !== recomputedAnswer) {
    errors.push('worksheet answer must equal the recomputed structured result');
  }
  try {
    if (question.id !== worksheetQuestionId(config, question)) errors.push('worksheet question id must match its canonical config and content');
  } catch {
    errors.push('worksheet question id requires serializable canonical config and content');
  }
  return { valid: errors.length === 0, errors };
};

export const certifyWorksheetFamilyQuestions = (questions, configInput) => {
  const { config, errors } = certifyConfig(configInput);
  if (!config) return { valid: false, errors };
  if (!Array.isArray(questions)) return { valid: false, errors: ['worksheet family questions must be an array'] };
  if (questions.length !== config.count) errors.push(`worksheet family list must contain ${config.count} questions`);
  const ids = new Set();
  questions.forEach((question, index) => {
    const certification = certifyWorksheetFamilyQuestion(question, config, index);
    errors.push(...certification.errors.map((error) => `question ${index}: ${error}`));
    if (ids.has(question?.id)) errors.push(`question ${index}: worksheet ids must be unique`);
    if (question?.id) ids.add(question.id);
  });
  return { valid: errors.length === 0, errors };
};

export const buildWorksheetFamilyQuestions = (configInput) => {
  const config = createWorksheetFamilyConfig(configInput);
  const questions = [];
  const prompts = new Set();
  for (let index = 0; index < config.count; index += 1) {
    const sourceFamily = config.sourceFamilies[index % config.sourceFamilies.length];
    const resolved = resolveWorksheetFamily(sourceFamily, config.submode);
    const requiresUniquePrompt = sourceFamily === 'mixed' || sourceFamily === 'sequence' || resolved.family === 'anzan';
    let fallback = null;
    let question = null;
    const maxAttempts = requiresUniquePrompt ? 1200 : 240;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = buildWorksheetFamilyQuestionCandidate(config, index, attempt);
      if (!candidate) continue;
      const certification = certifyWorksheetFamilyQuestion(candidate, config, index);
      if (!certification.valid) continue;
      fallback ||= candidate;
      const prompt = formatWorksheetFamilyQuestion(candidate);
      if (prompts.has(prompt)) continue;
      question = candidate;
      break;
    }
    if (!question && !requiresUniquePrompt) question = fallback || buildWorksheetFamilyQuestionCandidate(config, index, maxAttempts + index);
    if (!question) throw new Error(`Unable to generate a unique certified worksheet question at index ${index}.`);
    const prompt = formatWorksheetFamilyQuestion(question);
    prompts.add(prompt);
    questions.push(question);
  }
  const certification = certifyWorksheetFamilyQuestions(questions, config);
  if (!certification.valid) throw new Error(`Generated worksheet family list failed certification: ${certification.errors.join('; ')}`);
  return questions;
};
