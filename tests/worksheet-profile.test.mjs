import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeneratedWorksheetQuestions,
  certifyWorksheetContentData,
  certifyWorksheetDrill,
  createWorksheetProfile,
} from '../src/lib/worksheet.js';

test('generated mixed worksheet stays inside 3-4 digits and 2-10 ops', () => {
  const profile = createWorksheetProfile({ digitRange: '3-4', operationRange: '2-10', operatorMode: 'mixed' });
  const questions = buildGeneratedWorksheetQuestions({ level: 'L3', length: 12, sessionId: 'mixed-proof', profile });

  assert.equal(questions.length, 12);
  questions.forEach((question) => {
    const certification = certifyWorksheetDrill(profile, question.worksheetTerms);
    assert.equal(certification.valid, true, certification.errors.join(', '));
    assert.ok(question.worksheetTerms.length - 1 >= 2);
    assert.ok(question.worksheetTerms.length - 1 <= 10);
  });
});

test('addition-only profile emits only plus operators', () => {
  const profile = createWorksheetProfile({ digitRange: '2-3', operationRange: '2-3', operatorMode: 'add' });
  const questions = buildGeneratedWorksheetQuestions({ level: 'L3', length: 6, sessionId: 'add-only', profile });

  questions.forEach((question) => {
    question.worksheetTerms.slice(1).forEach((term) => {
      assert.equal(term.operator, '+');
    });
  });
});

test('subtraction-only profile emits only minus operators', () => {
  const profile = createWorksheetProfile({ digitRange: '2-2', operationRange: '4-6', operatorMode: 'subtract' });
  const questions = buildGeneratedWorksheetQuestions({ level: 'L3', length: 6, sessionId: 'subtract-only', profile });

  questions.forEach((question) => {
    question.worksheetTerms.slice(1).forEach((term) => {
      assert.equal(term.operator, '-');
    });
    assert.ok(question.answer >= 0);
  });
});

test('certification fails when a 2-digit operand appears in a 3-4 digit profile', () => {
  const profile = createWorksheetProfile({ digitRange: '3-4', operationRange: '2-3', operatorMode: 'mixed' });
  const badWorksheet = [
    { operator: null, value: 520 },
    { operator: '-', value: 44 },
    { operator: '+', value: 129 },
  ];

  const certification = certifyWorksheetDrill(profile, badWorksheet);
  assert.equal(certification.valid, false);
  assert.match(certification.errors.join(' '), /3-4 digits/);
});

test('authored worksheet certification passes with normalized label', () => {
  const result = certifyWorksheetContentData({
    worksheetProfile: {
      digitRange: '3-4',
      operationRange: '2-3',
      operatorMode: 'mixed',
      label: '3-4 digits · 2-3 ops · mixed',
    },
    worksheetDrill: [
      { value: 520 },
      { operator: '-', value: 184 },
      { operator: '+', value: 129 },
    ],
  });

  assert.equal(result.valid, true, result.errors.join(', '));
});

test('authored worksheet certification fails when label is not normalized', () => {
  const result = certifyWorksheetContentData({
    worksheetProfile: {
      digitRange: '3-4',
      operationRange: '2-3',
      operatorMode: 'mixed',
      label: 'L3 mixed columns',
    },
    worksheetDrill: [
      { value: 520 },
      { operator: '-', value: 184 },
      { operator: '+', value: 129 },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /normalized label/);
});

test('authored worksheet certification fails when profile exceeds supported v1 bounds', () => {
  const result = certifyWorksheetContentData({
    worksheetProfile: {
      digitRange: '1-5',
      operationRange: '2-12',
      operatorMode: 'mixed',
      label: '1-5 digits · 2-12 ops · mixed',
    },
    worksheetDrill: [
      { value: 10000 },
      { operator: '+', value: 9999 },
      { operator: '-', value: 1111 },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /2-4 digits|2-10/);
});
