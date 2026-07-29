const isRecord = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const normalizeEvaluationText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const invalid = (kind = 'unknown') => ({ valid: false, correct: false, kind });

export const evaluateResponse = (evaluation, response) => {
  if (!isRecord(evaluation) || typeof evaluation.kind !== 'string') return invalid();
  const input = String(response ?? '').trim();
  if (!input) return { valid: true, correct: false, kind: evaluation.kind };

  if (evaluation.kind === 'numeric') {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(input)) return { valid: true, correct: false, kind: 'numeric' };
    const actual = Number(input);
    const accepted = Array.isArray(evaluation.accepted) ? evaluation.accepted.map(Number).filter(Number.isFinite) : [];
    if (!Number.isFinite(actual) || accepted.length === 0) return invalid('numeric');
    const tolerance = Math.max(0, Number(evaluation.tolerance) || 0);
    return { valid: true, correct: accepted.some((expected) => Math.abs(actual - expected) <= tolerance), kind: 'numeric' };
  }

  if (evaluation.kind === 'concepts') {
    const allOf = Array.isArray(evaluation.allOf) ? evaluation.allOf : [];
    if (!allOf.length || allOf.some((group) => !Array.isArray(group) || !group.length)) return invalid('concepts');
    const actual = ` ${normalizeEvaluationText(input)} `;
    const correct = allOf.every((group) => group.some((term) => {
      const normalized = normalizeEvaluationText(term);
      return normalized && actual.includes(` ${normalized} `);
    }));
    return { valid: true, correct, kind: 'concepts' };
  }

  if (evaluation.kind === 'pairs') {
    const target = Number(evaluation.target);
    const pairs = Array.isArray(evaluation.pairs) ? evaluation.pairs : [];
    const validPairs = Number.isFinite(target)
      && pairs.length > 0
      && pairs.every((pair) => Array.isArray(pair)
        && pair.length === 2
        && pair.every((value) => Number.isInteger(Number(value)))
        && Number(pair[0]) + Number(pair[1]) === target);
    if (!validPairs) return invalid('pairs');
    const actual = (input.match(/-?\d+/g) || []).map(Number);
    const expected = pairs.flatMap((pair) => pair.map(Number));
    return { valid: true, correct: actual.length === expected.length && actual.every((value, index) => value === expected[index]), kind: 'pairs' };
  }

  if (evaluation.kind === 'exact') {
    const accepted = Array.isArray(evaluation.accepted) ? evaluation.accepted : [];
    if (!accepted.length) return invalid('exact');
    const actual = normalizeEvaluationText(input);
    return { valid: true, correct: accepted.some((value) => normalizeEvaluationText(value) === actual), kind: 'exact' };
  }

  return invalid(evaluation.kind);
};
