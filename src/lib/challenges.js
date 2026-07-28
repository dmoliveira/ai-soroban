import { createRng } from './worksheet.js';

export const CHALLENGE_RULE_VERSION = 1;

export const CHALLENGE_DEFINITIONS = {
  'bead-match': {
    key: 'bead-match',
    title: 'Bead match',
    summary: 'Read every single-digit soroban shape once in a calm visual round.',
    target: 'Read at least 8 of 10 bead values correctly on the first check.',
    rule: 'The round shows each value from 0 through 9 exactly once. Reveals and recovery answers do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'single', type: 'generated', level: 'L0', length: 10, checkMode: 'verify', timerMode: 'off', questionStyle: 'visual-read', termCount: '2' },
  },
  'clean-five': {
    key: 'clean-five',
    title: 'Clean five',
    summary: 'Recognize upper-bead values until every clean-five shape feels familiar.',
    target: 'Read at least 8 of 10 clean-five values correctly on the first check.',
    rule: 'Values 5 through 9 each appear exactly twice. Reveals and recovery answers do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'single', type: 'generated', level: 'L1', length: 10, checkMode: 'verify', timerMode: 'off', questionStyle: 'visual-five', termCount: '2' },
  },
  'streak-sprint': {
    key: 'streak-sprint',
    title: 'Streak sprint',
    summary: 'Build clean momentum through a short alternating arithmetic run.',
    target: 'Reach a first-check correct streak of at least 8.',
    rule: 'Solve 15 facts that alternate addition and subtraction. Every result stays non-negative; a miss, reveal, or recovery breaks the streak.',
    metric: 'longestStreak',
    threshold: 8,
    config: { format: 'single', type: 'generated', level: 'L3', length: 15, checkMode: 'verify', timerMode: 'on', questionStyle: 'mixed', termCount: '2' },
  },
  'sign-switch-relay': {
    key: 'sign-switch-relay',
    title: 'Sign switch relay',
    summary: 'Hold a running total while plus and minus signs trade places.',
    target: 'Solve at least 8 of 10 sign-switch sequences correctly on the first check.',
    rule: 'Every question has four terms with strictly alternating signs and no negative running total. Reveals and recovery answers do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'sheet', type: 'generated', level: 'L3', length: 10, checkMode: 'verify', timerMode: 'off', questionStyle: 'mixed', termCount: '4' },
  },
  'table-ladder': {
    key: 'table-ladder',
    title: 'Table ladder',
    summary: 'Climb one multiplication family in order instead of jumping between facts.',
    target: 'Solve at least 8 of 10 ladder facts correctly on the first check.',
    rule: 'One seeded table from 2 through 9 is tested in order from ×1 through ×10. Reveals do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'sheet', type: 'generated', level: 'L4', length: 10, checkMode: 'verify', timerMode: 'off', questionStyle: 'mixed', termCount: '2' },
  },
  'quotient-chase': {
    key: 'quotient-chase',
    title: 'Quotient chase',
    summary: 'Find exact quotients across one connected division family.',
    target: 'Solve at least 8 of 10 exact divisions correctly on the first check.',
    rule: 'One seeded divisor from 2 through 9 is used with exact quotients 1 through 10 in order. Reveals do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'sheet', type: 'generated', level: 'L4', length: 10, checkMode: 'verify', timerMode: 'on', questionStyle: 'mixed', termCount: '2' },
  },
  'anzan-burst': {
    key: 'anzan-burst',
    title: 'Anzan burst',
    summary: 'Hold short mental sequences through deliberate sign changes.',
    target: 'Solve at least 8 of 10 mental sequences correctly on the first check.',
    rule: 'Every question has four terms, includes both addition and subtraction, and keeps the running total non-negative. Reveals and recovery answers do not count.',
    metric: 'correct',
    threshold: 8,
    config: { format: 'single', type: 'generated', level: 'L5', length: 10, checkMode: 'verify', timerMode: 'on', questionStyle: 'mental', termCount: '4' },
  },
};

export const CHALLENGE_LIST = Object.values(CHALLENGE_DEFINITIONS);

const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;

const shuffle = (rng, values) => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

const evaluateTerms = (terms) => terms.slice(1).reduce((total, term) => (
  term.operator === '-' ? total - term.value : total + term.value
), terms[0]?.value || 0);

const runningTotalsStayNonNegative = (terms) => {
  let total = terms[0]?.value || 0;
  if (total < 0) return false;
  return terms.slice(1).every((term) => {
    total = term.operator === '-' ? total - term.value : total + term.value;
    return total >= 0;
  });
};

const sequenceQuestion = ({ challengeKey, seed, index, terms, title, promptPrefix, skill = 'mixed-operations' }) => {
  const expression = terms.map((term, termIndex) => (
    termIndex === 0 ? String(term.value) : `${term.operator} ${term.value}`
  )).join(' ');
  const answer = evaluateTerms(terms);
  return {
    id: `${seed}-challenge-${index}`,
    progressKey: `challenge-${challengeKey}-${index}`,
    title: `${title} ${index + 1}`,
    prompt: `${promptPrefix} ${expression}.`,
    answer,
    visualValue: null,
    steps: [
      `Start at ${terms[0].value}.`,
      ...terms.slice(1).map((term) => `${term.operator === '-' ? 'Subtract' : 'Add'} ${term.value}.`),
      `Final value: ${answer}.`,
    ],
    skill,
    challengeData: { kind: 'sequence', terms },
  };
};

const buildAlternatingTerms = (rng, termCount, { minStart, maxStart, maxStep }) => {
  const terms = [{ operator: null, value: randInt(rng, minStart, maxStart) }];
  let total = terms[0].value;
  let operator = rng() >= 0.5 ? '+' : '-';
  for (let index = 1; index < termCount; index += 1) {
    const maxValue = operator === '-' ? Math.max(1, Math.min(maxStep, total)) : maxStep;
    const value = randInt(rng, 1, maxValue);
    terms.push({ operator, value });
    total = operator === '-' ? total - value : total + value;
    operator = operator === '+' ? '-' : '+';
  }
  return terms;
};

const buildChallengeQuestionList = (challengeKey, seed, rng) => {
  if (challengeKey === 'bead-match') {
    return shuffle(rng, Array.from({ length: 10 }, (_, value) => value)).map((value, index) => ({
      id: `${seed}-challenge-${index}`,
      progressKey: `challenge-bead-match-${value}`,
      title: `Bead value ${index + 1}`,
      prompt: 'Read the rod that is shown. What value do you see?',
      answer: value,
      visualValue: value,
      steps: ['Read the beads touching the beam.', `The rod shows ${value}.`],
      skill: 'number-reading',
      challengeData: { kind: 'visual-value', value },
    }));
  }

  if (challengeKey === 'clean-five') {
    return shuffle(rng, [5, 5, 6, 6, 7, 7, 8, 8, 9, 9]).map((value, index) => ({
      id: `${seed}-challenge-${index}`,
      progressKey: `challenge-clean-five-${index}`,
      title: `Clean-five value ${index + 1}`,
      prompt: 'Read the rod with the upper bead active. What value do you see?',
      answer: value,
      visualValue: value,
      steps: ['The upper bead gives 5.', `Add the lower beads to read ${value}.`],
      skill: 'number-reading',
      challengeData: { kind: 'visual-value', value },
    }));
  }

  if (challengeKey === 'streak-sprint') {
    const firstOperator = rng() >= 0.5 ? '+' : '-';
    return Array.from({ length: 15 }, (_, index) => {
      const operator = index % 2 === 0 ? firstOperator : firstOperator === '+' ? '-' : '+';
      const right = randInt(rng, 1, 20);
      const left = operator === '-' ? randInt(rng, right, 60) : randInt(rng, 1, 50);
      const answer = operator === '-' ? left - right : left + right;
      return {
        id: `${seed}-challenge-${index}`,
        progressKey: `challenge-streak-sprint-${index}`,
        title: `Sprint fact ${index + 1}`,
        prompt: `Solve ${left} ${operator} ${right}.`,
        answer,
        visualValue: null,
        steps: [`Start at ${left}.`, `${operator === '-' ? 'Subtract' : 'Add'} ${right}.`, `Final value: ${answer}.`],
        skill: operator === '-' ? 'subtraction' : 'addition',
        challengeData: { kind: 'binary', operands: [left, right], operator },
      };
    });
  }

  if (challengeKey === 'sign-switch-relay' || challengeKey === 'anzan-burst') {
    return Array.from({ length: 10 }, (_, index) => sequenceQuestion({
      challengeKey,
      seed,
      index,
      terms: buildAlternatingTerms(rng, 4, challengeKey === 'anzan-burst'
        ? { minStart: 20, maxStart: 80, maxStep: 30 }
        : { minStart: 50, maxStart: 200, maxStep: 60 }),
      title: challengeKey === 'anzan-burst' ? 'Mental sequence' : 'Sign-switch sequence',
      promptPrefix: challengeKey === 'anzan-burst' ? 'Without moving beads, solve' : 'Keep the running total through',
      skill: challengeKey === 'anzan-burst' ? 'anzan' : 'mixed-operations',
    }));
  }

  if (challengeKey === 'table-ladder') {
    const multiplicand = randInt(rng, 2, 9);
    return Array.from({ length: 10 }, (_, index) => {
      const factor = index + 1;
      const answer = multiplicand * factor;
      return {
        id: `${seed}-challenge-${index}`,
        progressKey: `challenge-table-ladder-${multiplicand}-${factor}`,
        title: `Table ${multiplicand} · rung ${factor}`,
        prompt: `Solve ${multiplicand} × ${factor}.`,
        answer,
        visualValue: null,
        steps: [`Use the ${multiplicand} table.`, `${multiplicand} × ${factor} = ${answer}.`],
        skill: 'multiplication',
        challengeData: { kind: 'multiplication', multiplicand, factor },
      };
    });
  }

  if (challengeKey === 'quotient-chase') {
    const divisor = randInt(rng, 2, 9);
    return Array.from({ length: 10 }, (_, index) => {
      const quotient = index + 1;
      const dividend = divisor * quotient;
      return {
        id: `${seed}-challenge-${index}`,
        progressKey: `challenge-quotient-chase-${divisor}-${quotient}`,
        title: `Divisor ${divisor} · quotient ${quotient}`,
        prompt: `Solve ${dividend} ÷ ${divisor}.`,
        answer: quotient,
        visualValue: null,
        steps: [`Ask what times ${divisor} gives ${dividend}.`, `${dividend} ÷ ${divisor} = ${quotient}.`],
        skill: 'division',
        challengeData: { kind: 'division', dividend, divisor, quotient },
      };
    });
  }

  throw new Error(`Unknown challenge: ${challengeKey}`);
};

const recomputeAnswer = (question) => {
  const data = question?.challengeData;
  if (!data) return Number.NaN;
  if (data.kind === 'visual-value') return data.value;
  if (data.kind === 'binary') {
    const [left, right] = data.operands || [];
    return data.operator === '-' ? left - right : data.operator === '+' ? left + right : Number.NaN;
  }
  if (data.kind === 'sequence') return evaluateTerms(data.terms || []);
  if (data.kind === 'multiplication') return data.multiplicand * data.factor;
  if (data.kind === 'division') return data.dividend / data.divisor;
  return Number.NaN;
};

export const certifyChallengeQuestions = (challengeKey, questions) => {
  const definition = CHALLENGE_DEFINITIONS[challengeKey];
  const errors = [];
  if (!definition) return { valid: false, errors: [`unknown challenge: ${challengeKey}`] };
  if (!Array.isArray(questions)) return { valid: false, errors: ['questions must be an array'] };
  if (questions.length !== definition.config.length) errors.push(`expected ${definition.config.length} questions, got ${questions.length}`);

  questions.forEach((question, index) => {
    const recomputed = recomputeAnswer(question);
    if (!Number.isFinite(recomputed)) errors.push(`question ${index} has invalid structured data`);
    if (question?.answer !== recomputed) errors.push(`question ${index} answer does not match structured data`);
    if (!question?.id || !question?.progressKey || !question?.title || !question?.prompt || !Array.isArray(question?.steps)) {
      errors.push(`question ${index} is missing renderer fields`);
    }
  });

  if (challengeKey === 'bead-match') {
    const values = questions.map((question) => question.challengeData?.value).sort((a, b) => a - b);
    if (values.join(',') !== '0,1,2,3,4,5,6,7,8,9') errors.push('bead match must contain each value 0-9 exactly once');
  }
  if (challengeKey === 'clean-five') {
    const values = questions.map((question) => question.challengeData?.value).sort((a, b) => a - b);
    if (values.join(',') !== '5,5,6,6,7,7,8,8,9,9') errors.push('clean five must contain each value 5-9 exactly twice');
  }
  if (challengeKey === 'streak-sprint') {
    const operators = questions.map((question) => question.challengeData?.operator);
    operators.forEach((operator, index) => {
      if (!['+', '-'].includes(operator)) errors.push(`streak question ${index} must use + or -`);
      if (index > 0 && operator === operators[index - 1]) errors.push(`streak question ${index} must alternate signs`);
      if (recomputeAnswer(questions[index]) < 0) errors.push(`streak question ${index} must stay non-negative`);
    });
  }
  if (challengeKey === 'sign-switch-relay' || challengeKey === 'anzan-burst') {
    questions.forEach((question, index) => {
      const terms = question.challengeData?.terms || [];
      const operators = terms.slice(1).map((term) => term.operator);
      if (terms.length !== 4) errors.push(`sequence ${index} must contain four terms`);
      if (!operators.includes('+') || !operators.includes('-')) errors.push(`sequence ${index} must include + and -`);
      if (challengeKey === 'sign-switch-relay' && operators.some((operator, operatorIndex) => operatorIndex > 0 && operator === operators[operatorIndex - 1])) {
        errors.push(`sequence ${index} must alternate signs`);
      }
      if (!runningTotalsStayNonNegative(terms)) errors.push(`sequence ${index} must keep non-negative running totals`);
    });
  }
  if (challengeKey === 'table-ladder') {
    const multiplicands = new Set(questions.map((question) => question.challengeData?.multiplicand));
    const factors = questions.map((question) => question.challengeData?.factor);
    const family = questions[0]?.challengeData?.multiplicand;
    if (multiplicands.size !== 1 || family < 2 || family > 9) errors.push('table ladder must use one table from 2-9');
    if (factors.join(',') !== '1,2,3,4,5,6,7,8,9,10') errors.push('table ladder must cover factors 1-10 in order');
  }
  if (challengeKey === 'quotient-chase') {
    const divisors = new Set(questions.map((question) => question.challengeData?.divisor));
    const divisor = questions[0]?.challengeData?.divisor;
    const quotients = questions.map((question) => question.challengeData?.quotient);
    if (divisors.size !== 1 || divisor < 2 || divisor > 9) errors.push('quotient chase must use one divisor from 2-9');
    if (quotients.join(',') !== '1,2,3,4,5,6,7,8,9,10') errors.push('quotient chase must cover quotients 1-10 in order');
    questions.forEach((question, index) => {
      const data = question.challengeData || {};
      if (data.dividend !== data.divisor * data.quotient) errors.push(`division question ${index} must divide exactly`);
    });
  }

  return { valid: errors.length === 0, errors };
};

export const buildChallengeQuestions = ({ challengeKey, seed }) => {
  if (!CHALLENGE_DEFINITIONS[challengeKey]) throw new Error(`Unknown challenge: ${challengeKey}`);
  const normalizedSeed = String(seed || `${challengeKey}-seed`);
  const questions = buildChallengeQuestionList(challengeKey, normalizedSeed, createRng(`${normalizedSeed}:${challengeKey}`));
  const certification = certifyChallengeQuestions(challengeKey, questions);
  if (!certification.valid) {
    throw new Error(`Generated ${challengeKey} challenge failed certification: ${certification.errors.join('; ')}`);
  }
  return questions;
};

const responseQualifies = (question, response) => {
  if (!response?.verified || response.attempts !== 1) return false;
  if (response.hintsUsed || response.revealedFinal || response.revealedSteps || response.recoveryUsed || response.recoveryMode) return false;
  const input = String(response.input ?? '').trim();
  if (!input) return false;
  const numericInput = Number(input);
  return Number.isFinite(numericInput) && numericInput === recomputeAnswer(question);
};

export const evaluateChallengeOutcome = ({ challengeKey, questions, responses = {} }) => {
  const definition = CHALLENGE_DEFINITIONS[challengeKey];
  const certification = certifyChallengeQuestions(challengeKey, questions);
  if (!definition || !certification.valid) {
    return {
      valid: false,
      met: false,
      metric: definition?.metric || 'correct',
      value: 0,
      threshold: definition?.threshold || 0,
      total: Array.isArray(questions) ? questions.length : 0,
      errors: certification.errors,
    };
  }

  const qualified = questions.map((question, index) => responseQualifies(question, responses[index]));
  const correctCount = qualified.filter(Boolean).length;
  let longestStreak = 0;
  let currentStreak = 0;
  qualified.forEach((correct) => {
    currentStreak = correct ? currentStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, currentStreak);
  });
  const value = definition.metric === 'longestStreak' ? longestStreak : correctCount;
  return {
    valid: true,
    met: value >= definition.threshold,
    metric: definition.metric,
    value,
    threshold: definition.threshold,
    total: questions.length,
    correctCount,
    longestStreak,
    errors: [],
  };
};

export const formatChallengeOutcome = (outcome) => {
  if (!outcome?.valid) return 'Challenge result unavailable';
  const measure = outcome.metric === 'longestStreak'
    ? `longest first-check streak ${outcome.value}`
    : `${outcome.value}/${outcome.total} first-check correct`;
  return `${outcome.met ? 'Target met' : 'Target not met yet'} · ${measure} · target ${outcome.threshold}`;
};

export const canonicalizeChallengeSession = (session) => {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  if (!session.challengeKey) return session;
  const definition = CHALLENGE_DEFINITIONS[session.challengeKey];
  const seed = String(session.challengeSeed || session.id || '');
  if (!definition || !seed) return null;
  const questions = buildChallengeQuestions({ challengeKey: session.challengeKey, seed });
  const canonical = {
    ...session,
    type: definition.config.type,
    level: definition.config.level,
    length: definition.config.length,
    checkMode: definition.config.checkMode,
    timerEnabled: definition.config.timerMode === 'on',
    format: definition.config.format,
    questionStyle: definition.config.questionStyle,
    termCount: definition.config.termCount,
    challengeTitle: definition.title,
    challengeTarget: definition.target,
    challengeRule: definition.rule,
    challengeRuleVersion: CHALLENGE_RULE_VERSION,
    challengeSeed: seed,
    questions,
  };
  canonical.challengeOutcome = canonical.completed
    ? evaluateChallengeOutcome({
      challengeKey: canonical.challengeKey,
      questions,
      responses: canonical.responses || {},
    })
    : null;
  return canonical;
};
