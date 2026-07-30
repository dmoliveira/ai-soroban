import { resolveReviewTargetForLevel } from './learner-continuity.js';
import { createRng } from './worksheet.js';

export const CURATED_PRACTICE_BANK = Object.freeze([
  Object.freeze({ level: 'L0', title: 'Add 1 and 2', prompt: 'Start from 1. Add 2. What is the final value?', answer: 3, steps: Object.freeze(['Start at 1.', 'Add 2.', '1 + 2 = 3.']), visualValue: 3 }),
  Object.freeze({ level: 'L0', title: 'Add 2 and 2', prompt: 'Start from 2. Add 2. What is the final value?', answer: 4, steps: Object.freeze(['Start at 2.', 'Add 2.', '2 + 2 = 4.']), visualValue: 4 }),
  Object.freeze({ level: 'L0', title: 'Subtract 1 from 4', prompt: 'Start from 4. Subtract 1. What is the final value?', answer: 3, steps: Object.freeze(['Start at 4.', 'Subtract 1.', '4 - 1 = 3.']), visualValue: 3 }),
  Object.freeze({ level: 'L1', title: 'Add two and three', prompt: 'Start from 2. Add 3.', answer: 5, steps: Object.freeze(['Start at 2.', 'Add 3.', 'The rod becomes the clean five shape.', '2 + 3 = 5.']), visualValue: 5 }),
  Object.freeze({ level: 'L1', title: 'Add four and four', prompt: 'Start from 4. Add 4.', answer: 8, steps: Object.freeze(['Start at 4.', 'Add 4.', 'Read the rod as 5 + 3.', '4 + 4 = 8.']), visualValue: 8 }),
  Object.freeze({ level: 'L1', title: 'Subtract two from eight', prompt: 'Start from 8. Subtract 2.', answer: 6, steps: Object.freeze(['Start at 8.', 'Remove 2.', 'Read the rod again: 6.', '8 - 2 = 6.']), visualValue: 6 }),
  Object.freeze({ level: 'L2', title: 'Complement to five', prompt: 'You are at 2. Which number completes the rod to 5?', answer: 3, steps: Object.freeze(['Ask what 2 needs to become 5.', 'The missing part is 3.', '2 and 3 are a complement pair to 5.']), visualValue: 5 }),
  Object.freeze({ level: 'L2', title: 'Complement to ten', prompt: 'You are at 7. Which number completes the value to 10?', answer: 3, steps: Object.freeze(['Ask what 7 needs to become 10.', 'The missing part is 3.', '7 and 3 are a complement pair to 10.']), visualValue: 10 }),
  Object.freeze({ level: 'L2', title: 'Add three to seven', prompt: 'Start from 7. Add 3.', answer: 10, steps: Object.freeze(['Start at 7.', 'Notice 7 needs 3 to become 10.', 'Complete the ten.', '7 + 3 = 10.']), visualValue: 10 }),
  Object.freeze({ level: 'L2', title: 'Add three to two', prompt: 'Start from 2. Add 3 using the complement to 5.', answer: 5, steps: Object.freeze(['Start at 2.', 'Use the complement pair 2 and 3.', 'Move to the clean five shape.', '2 + 3 = 5.']), visualValue: 5 }),
  Object.freeze({ level: 'L3', skill: 'mixed-operations', title: 'Mixed sequence 126 to 145', prompt: 'Solve this sequence carefully: 126 + 37 - 18.', answer: 145, steps: Object.freeze(['Start at 126.', 'Add 37 to reach 163.', 'Subtract 18 to reach 145.']), visualValue: 145 }),
  Object.freeze({ level: 'L3', skill: 'mixed-operations', title: 'Mixed sequence 248 to 225', prompt: 'Solve this sequence carefully: 248 - 59 + 36.', answer: 225, steps: Object.freeze(['Start at 248.', 'Subtract 59 to reach 189.', 'Add 36 to reach 225.']), visualValue: 225 }),
  Object.freeze({ level: 'L3', skill: 'mixed-operations', title: 'Mixed sequence 175 to 250', prompt: 'Solve this sequence carefully: 175 + 48 + 27.', answer: 250, steps: Object.freeze(['Start at 175.', 'Add 48 to reach 223.', 'Add 27 to reach 250.']), visualValue: 250 }),
  Object.freeze({ level: 'L3', skill: 'mixed-operations', title: 'Mixed sequence 320 to 200', prompt: 'Solve this sequence carefully: 320 - 85 - 35.', answer: 200, steps: Object.freeze(['Start at 320.', 'Subtract 85 to reach 235.', 'Subtract 35 to reach 200.']), visualValue: 200 }),
  Object.freeze({ level: 'L4', skill: 'multiplication', title: 'Multiply 24 by 3', prompt: 'Solve 24 × 3.', answer: 72, steps: Object.freeze(['Break 24 into 20 and 4.', 'Multiply both parts by 3.', '60 + 12 = 72.']), visualValue: 72 }),
  Object.freeze({ level: 'L4', skill: 'multiplication', title: 'Multiply 46 by 4', prompt: 'Solve 46 × 4.', answer: 184, steps: Object.freeze(['Break 46 into 40 and 6.', 'Multiply both parts by 4.', '160 + 24 = 184.']), visualValue: 184 }),
  Object.freeze({ level: 'L4', skill: 'division', title: 'Divide 84 by 7', prompt: 'Solve 84 ÷ 7.', answer: 12, steps: Object.freeze(['Ask which factor with 7 gives 84.', '7 × 12 = 84.', 'The quotient is 12.']), visualValue: 12 }),
  Object.freeze({ level: 'L4', skill: 'division', title: 'Divide 144 by 12', prompt: 'Solve 144 ÷ 12.', answer: 12, steps: Object.freeze(['Use the matching multiplication fact.', '12 × 12 = 144.', 'The quotient is 12.']), visualValue: 12 }),
  Object.freeze({ level: 'L5', skill: 'anzan', title: 'Mental sequence warmup', prompt: 'Without moving beads, solve 18 + 7 + 5.', answer: 30, steps: Object.freeze(['Start at 18.', 'Add 7 to reach 25.', 'Add 5 to reach 30.']), visualValue: 30 }),
  Object.freeze({ level: 'L5', skill: 'anzan', title: 'Mental mixed review', prompt: 'Without moving beads, solve 24 - 6 + 8.', answer: 26, steps: Object.freeze(['Start at 24.', 'Subtract 6 to reach 18.', 'Add 8 to reach 26.']), visualValue: 26 }),
]);

export const practiceSlug = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)+/g, '');

const pick = (rng, items) => items[Math.floor(rng() * items.length)];

const resolveAdaptiveStyle = (level, questionStyle, reviewProfile) => {
  if (questionStyle !== 'adaptive') return questionStyle;
  const reviewTarget = resolveReviewTargetForLevel(reviewProfile, level);
  if (level === 'L5' || reviewTarget?.key === 'mental') return 'mental';
  if (level === 'L4' || reviewTarget?.key === 'multiplication' || reviewTarget?.key === 'division') return 'mixed';
  if (reviewTarget?.key === 'complements') return 'mixed';
  return 'visual';
};

const resolveTermCount = (level, termCount) => {
  if (termCount !== 'auto') return Number(termCount);
  if (level === 'L0' || level === 'L1') return 2;
  if (level === 'L2' || level === 'L3' || level === 'L4') return 3;
  return 4;
};

const buildSequence = (rng, start, stepCount, maxStep) => {
  const ops = [];
  let total = start;
  for (let index = 0; index < stepCount; index += 1) {
    const add = rng() > 0.45;
    const value = Math.max(1, Math.floor(rng() * maxStep) + 1);
    if (!add && total - value <= 0) {
      total += value;
      ops.push({ op: '+', value });
    } else if (add) {
      total += value;
      ops.push({ op: '+', value });
    } else {
      total -= value;
      ops.push({ op: '-', value });
    }
  }
  return { ops, total };
};

const buildGeneratedQuestion = (level, index, rng, questionStyle = 'mixed', termCount = 'auto', skill = null, reviewProfile = null) => {
  const effectiveStyle = resolveAdaptiveStyle(level, questionStyle, reviewProfile);
  const terms = resolveTermCount(level, termCount);
  if (level === 'L0') {
    if (effectiveStyle === 'visual-read') {
      const shown = Math.floor(rng() * 9) + 1;
      return {
        id: `g-${level}-${index}`,
        progressKey: `generated-${practiceSlug(`${level}-read-${shown}`)}`,
        title: `Visual bead read ${index + 1}`,
        prompt: 'Read the rod that is shown. What value do you see?',
        answer: shown,
        visualValue: shown,
        promptLines: ['Look at the beads touching the beam.', 'Read the displayed rod only.', 'Say the value before you type it.'],
        steps: ['Read the active beads.', `The rod shows ${shown}.`],
      };
    }
    const a = Math.floor(rng() * 4) + 1;
    const b = Math.floor(rng() * (5 - a)) + 1;
    const answer = a + b;
    return {
      id: `g-${level}-${index}`,
      progressKey: `generated-${practiceSlug(`${level}-${answer}`)}`,
      title: `Generated starter sum ${index + 1}`,
      prompt: effectiveStyle === 'visual' ? `After starting from ${a} and adding ${b}, the rod below shows the result. What final value do you read?` : `Start from ${a}. Add ${b}. What is the final value?`,
      answer,
      visualValue: answer,
      promptLines: effectiveStyle === 'visual' ? ['Look at the rod.', `Start from ${a}.`, `Add ${b}.`, 'Read the final bead pattern.'] : undefined,
      steps: [`Start at ${a}.`, `Add ${b}.`, `${a} + ${b} = ${answer}.`],
    };
  }
  if (level === 'L1') {
    if (effectiveStyle === 'visual-five') {
      const shown = [5, 6, 7, 8][index % 4];
      return {
        id: `g-${level}-${index}`,
        progressKey: `generated-${practiceSlug(`${level}-five-${shown}`)}`,
        title: `Clean five read ${index + 1}`,
        prompt: 'Read the rod with the upper bead active. What value do you see?',
        answer: shown,
        visualValue: shown,
        promptLines: ['Notice the upper bead touching the beam.', 'Count the lower beads that stay active.', 'Read the full clean-five shape.'],
        steps: ['The upper bead gives 5.', `Add the lower beads to read ${shown}.`],
      };
    }
    const a = Math.floor(rng() * 8) + 1;
    const b = Math.floor(rng() * (9 - a)) + 1;
    const subtract = skill === 'subtraction'
      ? true
      : skill === 'addition'
        ? false
        : effectiveStyle === 'mental'
          ? false
          : rng() > 0.5;
    if (subtract) {
      const start = a + b;
      return {
        id: `g-${level}-${index}`,
        progressKey: `generated-${practiceSlug(`${level}-${start}-${b}-${a}`)}`,
        title: `Generated subtraction ${index + 1}`,
        prompt: effectiveStyle === 'visual' ? `After starting from ${start} and subtracting ${b}, the rod below shows the result. What final value do you read?` : `Start from ${start}. Subtract ${b}. What is the final value?`,
        answer: a,
        visualValue: a,
        promptLines: effectiveStyle === 'visual' ? [`Set ${start} first.`, `Move ${b} away.`, 'Watch for the cleaner rod shape.', 'Read the final value.'] : undefined,
        steps: [`Start at ${start}.`, `Subtract ${b}.`, `${start} - ${b} = ${a}.`],
      };
    }
    return {
      id: `g-${level}-${index}`,
      progressKey: `generated-${practiceSlug(`${level}-${a}-${b}-${a + b}`)}`,
      title: `Generated addition ${index + 1}`,
      prompt: effectiveStyle === 'visual' ? `After starting from ${a} and adding ${b}, the rod below shows the result. What final value do you read?` : `Start from ${a}. Add ${b}. What is the final value?`,
      answer: a + b,
      visualValue: a + b,
      promptLines: effectiveStyle === 'visual' ? [`Set ${a}.`, `Add ${b}.`, 'Watch whether the clean five shape appears.', 'Read the final rod.'] : undefined,
      steps: [`Start at ${a}.`, `Add ${b}.`, `${a} + ${b} = ${a + b}.`],
    };
  }
  if (level === 'L3') {
    const a = Math.floor(rng() * 300) + 100;
    const sequence = buildSequence(rng, a, Math.max(2, terms - 1), 80);
    const promptOps = sequence.ops.map(({ op, value }) => `${op} ${value}`).join(' ');
    return {
      id: `g-${level}-${index}`,
      progressKey: `generated-${practiceSlug(`${level}-${a}-${promptOps}-${sequence.total}`)}`,
      title: `Generated sequence drill ${index + 1}`,
      prompt: `Solve this sequence carefully: ${a} ${promptOps}.`,
      answer: sequence.total,
      visualValue: sequence.total,
      steps: [`Start at ${a}.`, ...sequence.ops.map(({ op, value }) => `${op === '+' ? 'Add' : 'Subtract'} ${value}.`), `Final value: ${sequence.total}.`],
    };
  }
  if (level === 'L4') {
    const multiplication = skill === 'multiplication'
      ? true
      : skill === 'division'
        ? false
        : rng() > 0.5;
    if (multiplication) {
      const multiplicand = Math.floor(rng() * 90) + 10;
      const multiplier = Math.floor(rng() * 7) + 2;
      const answer = multiplicand * multiplier;
      return {
        id: `g-${level}-${index}`,
        progressKey: `generated-${practiceSlug(`${level}-${multiplicand}-${multiplier}-${answer}`)}`,
        title: `Generated multiplication drill ${index + 1}`,
        skill: 'multiplication',
        prompt: `Solve ${multiplicand} × ${multiplier}.`,
        answer,
        visualValue: answer,
        steps: [`Read ${multiplicand} as its place values.`, `Multiply by ${multiplier}.`, `Combine the partial products to reach ${answer}.`],
      };
    }
    const divisor = Math.floor(rng() * 7) + 3;
    const quotient = Math.floor(rng() * 8) + 2;
    const dividend = divisor * quotient;
    return {
      id: `g-${level}-${index}`,
      progressKey: `generated-${practiceSlug(`${level}-${dividend}-${divisor}-${quotient}`)}`,
      title: `Generated division drill ${index + 1}`,
      skill: 'division',
      prompt: `Solve ${dividend} ÷ ${divisor}.`,
      answer: quotient,
      visualValue: quotient,
      steps: [`Start from ${dividend}.`, `Ask what times ${divisor} gives ${dividend}.`, `The quotient is ${quotient}.`],
    };
  }
  if (level === 'L5' || effectiveStyle === 'mental') {
    const a = Math.floor(rng() * 60) + 20;
    const sequence = buildSequence(rng, a, Math.max(2, terms - 1), 30);
    const promptOps = sequence.ops.map(({ op, value }) => `${op} ${value}`).join(' ');
    return {
      id: `g-${level}-${index}`,
      progressKey: `generated-${practiceSlug(`${level}-${a}-${promptOps}-${sequence.total}`)}`,
      title: `Generated mental drill ${index + 1}`,
      prompt: `Without moving beads, solve ${a} ${promptOps}.`,
      answer: sequence.total,
      visualValue: sequence.total,
      steps: [`Start at ${a}.`, ...sequence.ops.map(({ op, value }) => `${op === '+' ? 'Add' : 'Subtract'} ${value}.`), `Final value: ${sequence.total}.`],
    };
  }
  const base = Math.floor(rng() * 8) + 1;
  const answer = 10 - base;
  return {
    id: `g-${level}-${index}`,
    progressKey: `generated-${practiceSlug(`${level}-${base}-${answer}`)}`,
    title: `Generated complement ${index + 1}`,
    prompt: effectiveStyle === 'mental' ? `Without moving beads yet, what number completes ${base} to 10?` : `You are at ${base}. Which number completes the value to 10?`,
    answer,
    visualValue: 10,
    steps: [`Start at ${base}.`, `Ask what ${base} needs to become 10.`, `The missing value is ${answer}.`],
  };
};

export const buildCuratedPracticeQuestions = (level, length, sessionId) => {
  const allowed = CURATED_PRACTICE_BANK.filter((item) => item.level === level);
  if (!allowed.length) throw new Error(`No curated practice bank exists for ${level}.`);
  const rng = createRng(sessionId);
  return Array.from({ length }, (_, index) => {
    const source = pick(rng, allowed);
    return {
      ...source,
      steps: [...source.steps],
      id: `${sessionId}-c-${index}`,
      progressKey: `curated-${practiceSlug(source.title)}`,
    };
  });
};

export const buildGeneratedPracticeQuestions = (level, length, sessionId, questionStyle, termCount, skill = null, reviewProfile = null) => {
  const rng = createRng(sessionId);
  return Array.from({ length }, (_, index) => buildGeneratedQuestion(level, index, rng, questionStyle, termCount, skill, reviewProfile));
};

export const buildJourneyPracticeQuestions = (journeyKey, length, sessionId) => {
  const rng = createRng(`${sessionId}-${journeyKey}`);
  const foundationValues = [3, 4, 5, 7, 8, 12, 24, 31, 42, 50];
  const fluencySets = [
    { prompt: '24 + 7 + 1', answer: 32, steps: ['Start at 24.', 'Add 7 to reach 31.', 'Add 1 to reach 32.'] },
    { prompt: '46 - 8 + 12', answer: 50, steps: ['Start at 46.', 'Subtract 8 to reach 38.', 'Add 12 to reach 50.'] },
    { prompt: '58 + 13 - 9', answer: 62, steps: ['Start at 58.', 'Add 13 to reach 71.', 'Subtract 9 to reach 62.'] },
  ];
  const mulDivSets = [
    { prompt: '12 × 3', answer: 36, skill: 'multiplication', steps: ['Use the 12 table fact.', '3 groups of 12 make 36.'] },
    { prompt: '24 ÷ 6', answer: 4, skill: 'division', steps: ['Ask which factor with 6 makes 24.', 'That factor is 4.'] },
    { prompt: '14 × 4', answer: 56, skill: 'multiplication', steps: ['Break 14 into 10 and 4.', '40 + 16 = 56.'] },
    { prompt: '36 ÷ 9', answer: 4, skill: 'division', steps: ['9 fits into 36 exactly 4 times.'] },
  ];
  const masterySets = [
    { prompt: '18 + 7 - 4 + 5', answer: 26, steps: ['18 + 7 = 25.', '25 - 4 = 21.', '21 + 5 = 26.'] },
    { prompt: '42 - 9 + 16 - 3', answer: 46, steps: ['42 - 9 = 33.', '33 + 16 = 49.', '49 - 3 = 46.'] },
    { prompt: '63 + 14 - 8 + 11', answer: 80, steps: ['63 + 14 = 77.', '77 - 8 = 69.', '69 + 11 = 80.'] },
  ];

  return Array.from({ length }, (_, index) => {
    if (journeyKey === 'foundations') {
      const value = pick(rng, foundationValues);
      return {
        id: `${sessionId}-j-${index}`,
        progressKey: `journey-foundations-${value}-${index}`,
        title: `Foundation visual ${index + 1}`,
        prompt: 'Read this soroban value before you type the answer.',
        answer: value,
        visualValue: value,
        steps: ['Look at the active beads rod by rod.', `Read the full value as ${value}.`],
      };
    }
    if (journeyKey === 'complements') {
      const base = index % 2 === 0 ? 10 : 5;
      const given = Math.max(1, Math.min(base - 1, Math.floor(rng() * (base - 1)) + 1));
      return {
        id: `${sessionId}-j-${index}`,
        progressKey: `journey-complements-${base}-${given}-${index}`,
        title: `Complement chain ${index + 1}`,
        prompt: `What completes ${given} to ${base}?`,
        answer: base - given,
        visualValue: base,
        steps: [`Ask what ${given} needs to become ${base}.`, `The missing part is ${base - given}.`],
      };
    }
    if (journeyKey === 'fluency') {
      const source = fluencySets[index % fluencySets.length];
      return {
        id: `${sessionId}-j-${index}`,
        progressKey: `journey-fluency-${index}`,
        title: `Fluency relay ${index + 1}`,
        ...source,
        steps: [...source.steps],
      };
    }
    if (journeyKey === 'muldiv') {
      const source = mulDivSets[index % mulDivSets.length];
      return {
        id: `${sessionId}-j-${index}`,
        progressKey: `journey-muldiv-${index}`,
        title: `Table and quotient ${index + 1}`,
        ...source,
        steps: [...source.steps],
      };
    }
    const source = masterySets[index % masterySets.length];
    return {
      id: `${sessionId}-j-${index}`,
      progressKey: `journey-mastery-${index}`,
      title: `Mental ladder ${index + 1}`,
      visualValue: null,
      ...source,
      steps: [...source.steps],
    };
  });
};

export const preparePracticeResponseForAdvance = (response, input) => {
  const current = response && typeof response === 'object' && !Array.isArray(response) ? response : {};
  const nextInput = String(input ?? '').trim();
  const priorInput = typeof current.input === 'string' ? current.input.trim() : '';
  const retainsVerification = nextInput === priorInput && current.verified === true;
  return {
    ...current,
    input: nextInput,
    verified: retainsVerification,
    correct: retainsVerification && current.correct === true,
  };
};
