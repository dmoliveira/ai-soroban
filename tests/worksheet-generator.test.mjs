import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKSHEET_FAMILY_RULE_VERSION,
  buildWorksheetFamilyQuestions,
  certifyWorksheetFamilyQuestion,
  certifyWorksheetFamilyQuestions,
  createWorksheetFamilyConfig,
  evaluateWorksheetFamilyOperands,
  formatWorksheetFamilyQuestion,
  worksheetSkillForQuestion,
  worksheetFamilyBandForIndex,
} from '../src/lib/worksheet.js';

const baseConfig = (overrides = {}) => ({
  seed: 'worksheet-family-test',
  count: 12,
  level: 'L3',
  sourceFamilies: ['mixed', 'sequence'],
  submode: 'auto',
  digitBand: '3-4',
  minOperations: 2,
  maxOperations: 4,
  flowMode: 'balanced',
  mode: 'dynamic',
  ...overrides,
});

const clone = (value) => structuredClone(value);

test('worksheet family config normalizes bounds and rejects unsupported v1 input', () => {
  const config = createWorksheetFamilyConfig(baseConfig({
    sourceFamilies: ['addition', 'addition', 'subtraction'],
    minOperations: 4,
    maxOperations: 2,
  }));

  assert.equal(config.ruleVersion, WORKSHEET_FAMILY_RULE_VERSION);
  assert.deepEqual(config.sourceFamilies, ['addition', 'subtraction']);
  assert.equal(config.minOperations, 2);
  assert.equal(config.maxOperations, 4);
  assert.equal(config.minDigits, 3);
  assert.equal(config.maxDigits, 4);

  assert.throws(() => createWorksheetFamilyConfig(baseConfig({ seed: '' })), /non-empty seed/);
  assert.throws(() => createWorksheetFamilyConfig(baseConfig({ digitBand: '0-7' })), /1-6 digits/);
  assert.throws(() => createWorksheetFamilyConfig(baseConfig({ maxOperations: 5 })), /within 1-4/);
  assert.throws(() => createWorksheetFamilyConfig(baseConfig({ ruleVersion: 2 })), /Unsupported worksheet family rule version/);
});

test('worksheet evidence skills use only canonical family and source mappings', () => {
  assert.equal(worksheetSkillForQuestion({ family: 'complement', sourceFamily: 'addition' }), 'complements');
  assert.equal(worksheetSkillForQuestion({ family: 'multiplication', sourceFamily: 'multiplication' }), 'multiplication');
  assert.equal(worksheetSkillForQuestion({ family: 'division', sourceFamily: 'division' }), 'division');
  assert.equal(worksheetSkillForQuestion({ family: 'anzan', sourceFamily: 'sequence' }), 'anzan');
  assert.equal(worksheetSkillForQuestion({ family: 'arithmetic', sourceFamily: 'addition' }), 'addition');
  assert.equal(worksheetSkillForQuestion({ family: 'arithmetic', sourceFamily: 'subtraction' }), 'subtraction');
  assert.equal(worksheetSkillForQuestion({ family: 'arithmetic', sourceFamily: 'mixed' }), 'mixed-operations');
  assert.equal(worksheetSkillForQuestion({ family: 'arithmetic', sourceFamily: 'sequence' }), 'mixed-operations');
  assert.equal(worksheetSkillForQuestion({ family: 'unknown', sourceFamily: 'unknown' }), null);
  assert.equal(worksheetSkillForQuestion(null), null);
});

test('worksheet family generation is deterministic per seed and fully certified', () => {
  const config = baseConfig({ count: 40 });
  const first = buildWorksheetFamilyQuestions(config);
  const repeated = buildWorksheetFamilyQuestions(config);
  const rotated = buildWorksheetFamilyQuestions({ ...config, seed: 'worksheet-family-rotated' });

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(rotated, first);
  assert.equal(new Set(first.map((question) => question.id)).size, first.length);
  assert.equal(new Set(first.map(formatWorksheetFamilyQuestion)).size, first.length);

  const certification = certifyWorksheetFamilyQuestions(first, config);
  assert.equal(certification.valid, true, certification.errors.join('\n'));
});

test('ramp flow applies the certified row band at each stage', () => {
  const config = createWorksheetFamilyConfig(baseConfig({ count: 20, digitBand: '2-4', flowMode: 'ramp' }));

  assert.deepEqual(worksheetFamilyBandForIndex(config, 0), { min: 2, max: 3 });
  assert.deepEqual(worksheetFamilyBandForIndex(config, 10), { min: 3, max: 4 });
  assert.deepEqual(worksheetFamilyBandForIndex(config, 19), { min: 4, max: 4 });

  const questions = buildWorksheetFamilyQuestions(config);
  questions.forEach((question, index) => {
    const band = worksheetFamilyBandForIndex(config, index);
    question.operands.forEach((operand) => {
      const digits = String(operand.value).length;
      assert.ok(digits >= band.min && digits <= band.max, `question ${index} operand ${operand.value} missed ${band.min}-${band.max}`);
    });
  });
});

test('certified families use role-specific operands and recomputed answers', () => {
  const cases = [
    {
      expectedFamily: 'additive',
      config: baseConfig({ sourceFamilies: ['addition'], submode: 'arithmetic-rhythm', digitBand: '2-3' }),
      assertQuestion(question) {
        assert.equal(question.operands[0].role, 'start');
        question.operands.slice(1).forEach((operand) => {
          assert.equal(operand.role, 'addend');
          assert.equal(operand.operator, '+');
        });
      },
    },
    {
      expectedFamily: 'complement',
      config: baseConfig({ level: 'L2', sourceFamilies: ['addition', 'subtraction'], submode: 'complement-balance', digitBand: '2-3' }),
      assertQuestion(question) {
        assert.match(question.technique.kind, /^complement-(5|10)$/);
        assert.ok(question.technique.moveIndex >= 1);
      },
    },
    {
      expectedFamily: 'multiplication',
      config: baseConfig({ level: 'L4', sourceFamilies: ['multiplication'], submode: 'place-shifts', digitBand: '2-4', minOperations: 1, maxOperations: 1 }),
      assertQuestion(question) {
        assert.deepEqual(question.operands.map(({ role, operator }) => ({ role, operator })), [
          { role: 'multiplicand', operator: null },
          { role: 'multiplier', operator: '×' },
        ]);
      },
    },
    {
      expectedFamily: 'division',
      config: baseConfig({ level: 'L4', sourceFamilies: ['division'], submode: 'quotient-building', digitBand: '2-4', minOperations: 1, maxOperations: 1 }),
      assertQuestion(question) {
        assert.deepEqual(question.operands.map(({ role, operator }) => ({ role, operator })), [
          { role: 'dividend', operator: null },
          { role: 'divisor', operator: '÷' },
        ]);
        assert.equal(question.operands[0].value % question.operands[1].value, 0);
      },
    },
    {
      expectedFamily: 'anzan',
      config: baseConfig({ level: 'L5', sourceFamilies: ['anzan'], submode: 'anzan-recall', digitBand: '4-6' }),
      assertQuestion(question) {
        assert.equal(question.operands[0].role, 'mental-start');
        assert.deepEqual(new Set(question.operands.slice(1).map((operand) => operand.operator)), new Set(['+', '-']));
        question.operands.slice(1).forEach((operand) => assert.match(operand.role, /^mental-(addend|subtrahend)$/));
      },
    },
  ];

  cases.forEach(({ config, expectedFamily, assertQuestion }) => {
    const questions = buildWorksheetFamilyQuestions(config);
    questions.forEach((question) => {
      assert.equal(question.family, expectedFamily);
      assert.equal(question.answer, evaluateWorksheetFamilyOperands(question.operands));
      assertQuestion(question);
    });
    const certification = certifyWorksheetFamilyQuestions(questions, config);
    assert.equal(certification.valid, true, `${expectedFamily}: ${certification.errors.join('\n')}`);
  });
});

test('certifier rejects recursive shape, role, answer, technique, and id tampering', () => {
  const config = baseConfig({
    count: 4,
    level: 'L2',
    sourceFamilies: ['addition'],
    submode: 'complement-balance',
    digitBand: '2-3',
  });
  const [question] = buildWorksheetFamilyQuestions(config);

  const cases = [
    ['exact v1 shape', (copy) => { copy.prompt = formatWorksheetFamilyQuestion(copy); }],
    ['exact v1 shape', (copy) => { copy.operands[0].extra = true; }],
    ['wrong role', (copy) => { copy.operands[1].role = 'multiplier'; }],
    ['recomputed structured result', (copy) => { copy.answer += 1; }],
    ['certified prefix move', (copy) => { copy.technique.kind = copy.technique.kind === 'complement-5' ? 'complement-10' : 'complement-5'; }],
    ['canonical config and content', (copy) => { copy.id = 'wf-v1-tampered'; }],
  ];

  cases.forEach(([message, mutate]) => {
    const tampered = clone(question);
    mutate(tampered);
    const certification = certifyWorksheetFamilyQuestion(tampered, config, 0);
    assert.equal(certification.valid, false, message);
    assert.match(certification.errors.join(' '), new RegExp(message));
  });
});

test('certification is key-order independent and returns errors for malformed recursion', () => {
  const config = baseConfig({
    count: 2,
    level: 'L2',
    sourceFamilies: ['addition'],
    submode: 'complement-balance',
    digitBand: '2-3',
  });
  const [question] = buildWorksheetFamilyQuestions(config);
  const reordered = {
    answer: question.answer,
    technique: { kind: question.technique.kind, moveIndex: question.technique.moveIndex },
    operands: question.operands.map((operand) => ({ value: operand.value, operator: operand.operator, role: operand.role })),
    rule: { version: question.rule.version, id: question.rule.id },
    submode: question.submode,
    sourceFamily: question.sourceFamily,
    family: question.family,
    level: question.level,
    index: question.index,
    id: question.id,
  };
  const reorderedCertification = certifyWorksheetFamilyQuestion(reordered, config, 0);
  assert.equal(reorderedCertification.valid, true, reorderedCertification.errors.join('\n'));

  const bigintOperand = clone(question);
  bigintOperand.operands[0].value = 22n;
  const bigintRule = clone(question);
  bigintRule.rule.version = 1n;
  const bigintAnswer = clone(question);
  bigintAnswer.answer = 1n;
  [
    { ...clone(question), rule: null },
    { ...clone(question), operands: [null, ...clone(question.operands.slice(1))] },
    { ...clone(question), technique: null },
    bigintOperand,
    bigintRule,
    bigintAnswer,
  ].forEach((malformed) => {
    let certification;
    assert.doesNotThrow(() => { certification = certifyWorksheetFamilyQuestion(malformed, config, 0); });
    assert.equal(certification.valid, false);
  });

  const bigintIndex = { ...clone(question), index: 0n };
  assert.doesNotThrow(() => certifyWorksheetFamilyQuestion(bigintIndex, config));
  assert.equal(certifyWorksheetFamilyQuestion(bigintIndex, config).valid, false);
});

test('complement certification requires the first qualifying prefix move', () => {
  const config = baseConfig({
    count: 1,
    level: 'L2',
    sourceFamilies: ['addition'],
    submode: 'complement-balance',
    digitBand: '2-3',
    minOperations: 2,
    maxOperations: 2,
  });
  const [question] = buildWorksheetFamilyQuestions(config);
  const tampered = {
    ...question,
    operands: [
      { role: 'start', operator: null, value: 22 },
      { role: 'addend', operator: '+', value: 13 },
      { role: 'addend', operator: '+', value: 15 },
    ],
    technique: { moveIndex: 2, kind: 'complement-10' },
    answer: 50,
  };

  const certification = certifyWorksheetFamilyQuestion(tampered, config, 0);
  assert.equal(certification.valid, false);
  assert.match(certification.errors.join(' '), /first certified prefix move/);
});
