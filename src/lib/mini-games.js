import { createRng } from './worksheet.js';

export const MINI_GAME_DEFINITIONS = {
  'complement-dash': {
    key: 'complement-dash',
    title: 'Number Bond Blitz',
    summary: 'Complete number bonds in a finite accuracy sprint.',
    rule: 'Each numeric answer consumes one question. If a time limit is selected, finish the list before the clock reaches zero.',
    kind: 'questions',
    thresholds: { bronze: 20, silver: 45, gold: 80 },
    defaults: { questionCount: 10, timeLimitSeconds: 30 },
    options: { questionCount: [5, 10, 20], timeLimitSeconds: [0, 15, 30, 60] },
  },
  'table-tower': {
    key: 'table-tower',
    title: 'Table Tower',
    summary: 'Climb a finite set of multiplication facts without losing your streak.',
    rule: 'Each numeric answer consumes one floor. The session ends after the configured question count.',
    kind: 'questions',
    thresholds: { bronze: 25, silver: 55, gold: 95 },
    defaults: { questionCount: 10 },
    options: { questionCount: [5, 10, 20] },
  },
  'anzan-flash': {
    key: 'anzan-flash',
    title: 'Flash Anzan',
    summary: 'Hold one paced signed sequence, then submit its final total.',
    rule: 'Terms appear one at a time. Answer once after the full sequence; Stop ends the session early.',
    kind: 'flash',
    thresholds: { bronze: 30, silver: 60, gold: 100 },
    defaults: { termCount: 20, intervalMs: 1000 },
    options: { termCount: [10, 20, 30], intervalMs: [500, 1000, 1500, 2000] },
  },
  'error-fix': {
    key: 'error-fix',
    title: 'Error Fix',
    summary: 'Repair a finite queue of incorrect arithmetic results.',
    rule: 'Type the corrected result. Each numeric answer consumes one repair.',
    kind: 'questions',
    thresholds: { bronze: 20, silver: 45, gold: 75 },
    defaults: { questionCount: 10 },
    options: { questionCount: [5, 10, 20] },
  },
};

export const MINI_GAME_LIST = Object.values(MINI_GAME_DEFINITIONS);
export const MINI_GAME_TIERS = ['starter', 'bronze', 'silver', 'gold'];

const randInt = (rng, min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (rng, values) => values[Math.floor(rng() * values.length)];

const allowedNumber = (value, allowed, fallback) => {
  const numeric = Number(value);
  return allowed.includes(numeric) ? numeric : fallback;
};

export const normalizeMiniGameSettings = (gameId, rawSettings = {}) => {
  const definition = MINI_GAME_DEFINITIONS[gameId];
  if (!definition) throw new Error(`Unknown mini-game: ${gameId}`);
  if (definition.kind === 'flash') {
    return {
      termCount: allowedNumber(rawSettings.termCount, definition.options.termCount, definition.defaults.termCount),
      intervalMs: allowedNumber(rawSettings.intervalMs, definition.options.intervalMs, definition.defaults.intervalMs),
    };
  }
  const settings = {
    questionCount: allowedNumber(rawSettings.questionCount, definition.options.questionCount, definition.defaults.questionCount),
  };
  if (definition.options.timeLimitSeconds) {
    settings.timeLimitSeconds = allowedNumber(
      rawSettings.timeLimitSeconds,
      definition.options.timeLimitSeconds,
      definition.defaults.timeLimitSeconds,
    );
  }
  return settings;
};

const normalizeTier = (tier) => MINI_GAME_TIERS.includes(tier) ? tier : 'starter';

const buildNumberBonds = (rng, tier, questionCount) => {
  const basesByTier = {
    starter: [5, 10],
    bronze: [10],
    silver: [10, 20],
    gold: [20, 50],
  };
  return Array.from({ length: questionCount }, (_, index) => {
    const base = pick(rng, basesByTier[tier]);
    const given = randInt(rng, 1, base - 1);
    return {
      id: `bond-${index}`,
      prompt: `What completes ${given} to ${base}?`,
      answer: base - given,
      data: { kind: 'number-bond', base, given },
    };
  });
};

const buildTableQuestions = (rng, tier, questionCount) => {
  const tablesByTier = {
    starter: [2, 3, 4, 5],
    bronze: [3, 4, 5, 6],
    silver: [6, 7, 8, 9],
    gold: [7, 8, 9, 12],
  };
  return Array.from({ length: questionCount }, (_, index) => {
    const table = pick(rng, tablesByTier[tier]);
    const factor = randInt(rng, 2, 10);
    return {
      id: `table-${index}`,
      prompt: `${table} × ${factor}`,
      answer: table * factor,
      data: { kind: 'multiplication', table, factor },
    };
  });
};

const buildErrorFixQuestions = (rng, tier, questionCount) => Array.from({ length: questionCount }, (_, index) => {
  let expression;
  let answer;
  let data;
  if (tier === 'silver' || tier === 'gold') {
    const multiplication = tier === 'silver' || rng() >= 0.5;
    if (multiplication) {
      const left = randInt(rng, tier === 'gold' ? 6 : 3, tier === 'gold' ? 24 : 12);
      const right = randInt(rng, 2, 9);
      answer = left * right;
      expression = `${left} × ${right}`;
      data = { kind: 'multiplication', left, right };
    } else {
      const divisor = randInt(rng, 2, 9);
      answer = randInt(rng, 2, 12);
      const dividend = divisor * answer;
      expression = `${dividend} ÷ ${divisor}`;
      data = { kind: 'division', dividend, divisor };
    }
  } else {
    const subtract = rng() >= 0.5;
    const right = randInt(rng, 1, tier === 'bronze' ? 30 : 9);
    const left = subtract
      ? randInt(rng, right, tier === 'bronze' ? 80 : 18)
      : randInt(rng, 1, tier === 'bronze' ? 50 : 12);
    answer = subtract ? left - right : left + right;
    expression = `${left} ${subtract ? '-' : '+'} ${right}`;
    data = { kind: subtract ? 'subtraction' : 'addition', left, right };
  }
  const offset = pick(rng, [-2, -1, 1, 2]);
  const shown = answer + offset;
  return {
    id: `error-${index}`,
    prompt: `Fix this result: ${expression} = ${shown}`,
    answer,
    data: { ...data, shown },
  };
});

const evaluateFlashTerms = (terms) => terms.slice(1).reduce((total, term) => (
  term.operator === '-' ? total - term.value : total + term.value
), terms[0]?.value || 0);

const buildFlashTerms = (rng, tier, termCount) => {
  const ranges = {
    starter: { min: 1, max: 9, startMin: 10, startMax: 30 },
    bronze: { min: 2, max: 20, startMin: 20, startMax: 50 },
    silver: { min: 5, max: 50, startMin: 50, startMax: 120 },
    gold: { min: 10, max: 99, startMin: 100, startMax: 250 },
  };
  const range = ranges[tier];
  const terms = [{ operator: null, value: randInt(rng, range.startMin, range.startMax) }];
  let total = terms[0].value;
  let operator = rng() >= 0.5 ? '+' : '-';
  for (let index = 1; index < termCount; index += 1) {
    const maxValue = operator === '-' ? Math.max(range.min, Math.min(range.max, total - 1)) : range.max;
    const minValue = Math.min(range.min, maxValue);
    const value = randInt(rng, minValue, maxValue);
    terms.push({ operator, value });
    total = operator === '-' ? total - value : total + value;
    operator = operator === '+' ? '-' : '+';
  }
  return terms;
};

const recomputeQuestionAnswer = (question) => {
  const data = question?.data || {};
  if (data.kind === 'number-bond') return data.base - data.given;
  if (data.kind === 'multiplication') return (data.table ?? data.left) * (data.factor ?? data.right);
  if (data.kind === 'division') return data.dividend / data.divisor;
  if (data.kind === 'subtraction') return data.left - data.right;
  if (data.kind === 'addition') return data.left + data.right;
  return Number.NaN;
};

export const certifyMiniGameRound = (round) => {
  const definition = MINI_GAME_DEFINITIONS[round?.gameId];
  const errors = [];
  if (!definition) return { valid: false, errors: ['unknown mini-game'] };
  const normalized = normalizeMiniGameSettings(round.gameId, round.settings);
  if (JSON.stringify(normalized) !== JSON.stringify(round.settings)) errors.push('settings are not normalized');
  if (!MINI_GAME_TIERS.includes(round.tier)) errors.push('tier is invalid');

  if (definition.kind === 'flash') {
    if (!Array.isArray(round.terms) || round.terms.length !== normalized.termCount) errors.push('flash term count does not match settings');
    let total = round.terms?.[0]?.value || 0;
    if (!Number.isInteger(total) || total <= 0) errors.push('flash must start with a positive integer');
    (round.terms || []).slice(1).forEach((term, index) => {
      if (!['+', '-'].includes(term.operator) || !Number.isInteger(term.value) || term.value <= 0) errors.push(`flash term ${index + 1} is invalid`);
      total = term.operator === '-' ? total - term.value : total + term.value;
      if (total <= 0) errors.push(`flash running total ${index + 1} must stay positive`);
    });
    if (round.answer !== evaluateFlashTerms(round.terms || [])) errors.push('flash answer does not match terms');
  } else {
    if (!Array.isArray(round.questions) || round.questions.length !== normalized.questionCount) errors.push('question count does not match settings');
    (round.questions || []).forEach((question, index) => {
      if (question.answer !== recomputeQuestionAnswer(question)) errors.push(`question ${index} answer does not match structured data`);
    });
  }
  return { valid: errors.length === 0, errors };
};

export const buildMiniGameRound = ({ gameId, tier = 'starter', settings = {}, seed = 'mini-game-seed' }) => {
  const definition = MINI_GAME_DEFINITIONS[gameId];
  if (!definition) throw new Error(`Unknown mini-game: ${gameId}`);
  const normalizedTier = normalizeTier(tier);
  const normalizedSettings = normalizeMiniGameSettings(gameId, settings);
  const normalizedSeed = String(seed);
  const rng = createRng(`${gameId}:${normalizedTier}:${normalizedSeed}`);
  const round = {
    gameId,
    tier: normalizedTier,
    settings: normalizedSettings,
    seed: normalizedSeed,
    ...(gameId === 'complement-dash'
      ? { questions: buildNumberBonds(rng, normalizedTier, normalizedSettings.questionCount) }
      : gameId === 'table-tower'
        ? { questions: buildTableQuestions(rng, normalizedTier, normalizedSettings.questionCount) }
        : gameId === 'error-fix'
          ? { questions: buildErrorFixQuestions(rng, normalizedTier, normalizedSettings.questionCount) }
          : (() => {
            const terms = buildFlashTerms(rng, normalizedTier, normalizedSettings.termCount);
            return { terms, answer: evaluateFlashTerms(terms) };
          })()),
  };
  const certification = certifyMiniGameRound(round);
  if (!certification.valid) throw new Error(`Generated ${gameId} round failed certification: ${certification.errors.join('; ')}`);
  return round;
};

export const createMiniGameState = (round) => ({
  round,
  gameId: round.gameId,
  status: 'idle',
  startedAt: null,
  deadlineAt: null,
  completedAt: null,
  reason: null,
  questionIndex: 0,
  answeredCount: 0,
  correctCount: 0,
  termsShown: 0,
  score: 0,
  streak: 0,
  longestStreak: 0,
  lastAnswerCorrect: null,
});

const finishState = (state, reason, now) => ({
  ...state,
  status: 'complete',
  reason,
  completedAt: Math.max(Number(now) || 0, state.startedAt || 0),
});

const deadlineReached = (state, now) => (
  state.gameId === 'complement-dash'
  && state.deadlineAt !== null
  && Number(now) >= state.deadlineAt
);

export const reduceMiniGameState = (state, event) => {
  if (!state || !event) return state;
  if (state.status === 'complete') return state;
  const now = Number(event.now) || 0;

  if (event.type === 'START') {
    if (state.status !== 'idle') return state;
    const timeLimit = state.round.settings.timeLimitSeconds;
    return {
      ...state,
      status: 'running',
      startedAt: now,
      deadlineAt: timeLimit ? now + (timeLimit * 1000) : null,
      termsShown: state.gameId === 'anzan-flash' ? 1 : 0,
    };
  }

  if (state.status === 'idle') return state;
  if (deadlineReached(state, now)) return finishState(state, 'time-expired', now);

  if (event.type === 'TICK') return state;
  if (event.type === 'STOP') return finishState(state, event.reason || 'stopped', now);

  if (event.type === 'SHOW_FLASH_TERM') {
    if (state.gameId !== 'anzan-flash' || state.status !== 'running') return state;
    return { ...state, termsShown: Math.min(state.round.terms.length, state.termsShown + 1) };
  }

  if (event.type === 'FLASH_READY') {
    if (state.gameId !== 'anzan-flash' || state.status !== 'running' || state.termsShown < state.round.terms.length) return state;
    return { ...state, status: 'awaiting-answer' };
  }

  if (event.type !== 'SUBMIT') return state;
  const input = String(event.input ?? '').trim();
  if (!input || !Number.isFinite(Number(input))) return state;

  if (state.gameId === 'anzan-flash') {
    if (state.status !== 'awaiting-answer') return state;
    const correct = Number(input) === state.round.answer;
    return finishState({
      ...state,
      answeredCount: 1,
      correctCount: correct ? 1 : 0,
      score: correct ? 100 : 0,
      streak: correct ? 1 : 0,
      longestStreak: correct ? 1 : 0,
      lastAnswerCorrect: correct,
    }, 'answer-submitted', now);
  }

  if (state.status !== 'running' || event.questionIndex !== state.questionIndex) return state;
  const question = state.round.questions[state.questionIndex];
  if (!question) return state;
  const correct = Number(input) === question.answer;
  const streak = correct ? state.streak + 1 : 0;
  const score = correct ? state.score + 10 + (streak * 2) : state.score;
  const nextState = {
    ...state,
    questionIndex: state.questionIndex + 1,
    answeredCount: state.answeredCount + 1,
    correctCount: state.correctCount + (correct ? 1 : 0),
    score,
    streak,
    longestStreak: Math.max(state.longestStreak, streak),
    lastAnswerCorrect: correct,
  };
  return nextState.questionIndex >= state.round.questions.length
    ? finishState(nextState, 'questions-complete', now)
    : nextState;
};

export const miniGameElapsedMs = (state, now = Date.now()) => {
  if (!state?.startedAt) return 0;
  return Math.max(0, (state.completedAt ?? Number(now)) - state.startedAt);
};

export const shouldPersistMiniGameResult = (state) => (
  state?.status === 'complete'
  && ['questions-complete', 'time-expired', 'answer-submitted'].includes(state.reason)
);
