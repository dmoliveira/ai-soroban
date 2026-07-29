# Worksheet Generator Specification

**Status:** implemented. This document records two related v1 contracts: the authored/generated addition/subtraction sequence profile and the deterministic worksheet-family generator used by the worksheet studio.

## Goal

Keep worksheet labels, prompts, operands, answers, teacher keys, adaptive targets, and saved presentation consistent with certified structured data.

The first target is to support:

- 2-digit through 4-digit arithmetic profiles such as `2-3 digits` and `3-4 digits`
- operation-count ranges from `2` through `10`
- simple operator modes: addition-only, subtraction-only, and mixed
- profile certification for both generated and authored worksheets
- visible worksheet profile labels such as `3-4 digits · 2-10 ops · mixed`

## Original gap (closed)

The original generated practice flow only supported:

- simple 2-digit reading prompts
- one-step addition or subtraction prompts
- complement-to-10 prompts

The current implementation now covers worksheet-style vertical arithmetic, configurable operation chains, profile labels, and certification tests.

## Scope

Delivered phase order:

1. apply the config model to generated drill sessions
2. apply the same profile model to authored worksheet content

In scope:

- generated practice sessions
- authored worksheet metadata and validation
- worksheet profile labels in the UI
- validator/test coverage for profile compliance

Out of scope for the sequence-profile v1 contract:

- user-authored exact sign templates such as a custom literal `+ - + -`
- multiplication and division within this specific `+`/`-` profile model (separate worksheet families implement them)
- automatic profile difficulty changes during an active generated sheet

## Certified worksheet-family v1

The worksheet studio uses a separate, versioned family contract for dynamic, fixed, and adaptive sheets. It does not widen the sequence-profile rules below.

Supported source families:

- addition, subtraction, mixed, and sequence
- multiplication and division
- anzan

Those sources resolve to five certified families: `additive`, `complement`, `multiplication`, `division`, and `anzan`. Every question stores an exact rule ID/version, source family, certified family, submode, role-labelled operands, technique metadata, and recomputed answer.

Family-v1 bounds and behavior:

- digit bands are ordered ranges from 1 through 6 digits
- requested operation bounds are ordered integers from 1 through 4
- multiplication and division always certify one operation with role-specific operands
- sequence and anzan questions require at least two operations
- counts are bounded from 1 through 100 questions
- `balanced` keeps one band across the sheet; `ramp` certifies the band for each row stage
- the active seed remains stable across presentation-only rerenders and rotates only when questions are refreshed
- adaptive mode selects a supported family/submode from local weak-area evidence without weakening certification

Prompts, score checks, worked examples, and teacher keys are formatted from structured operands. They are never parsed back from mutable display text to establish correctness.

## Worksheet profile model

Each generated or authored worksheet should declare a normalized profile object.

```ts
type OperatorMode = 'add' | 'subtract' | 'mixed';

interface WorksheetProfile {
  id: string;
  label: string;
  minDigits: number;
  maxDigits: number;
  minOperations: number;
  maxOperations: number;
  operatorMode: OperatorMode;
}
```

### Required rules

- `minDigits` and `maxDigits` must be between `2` and `4` for the initial release
- `minDigits <= maxDigits`
- `minOperations` and `maxOperations` must be between `2` and `10`
- `minOperations <= maxOperations`
- `operatorMode` must be `add`, `subtract`, or `mixed`

### Example profiles

- `2-3 digits · 2-3 ops · add`
- `3-4 digits · 2-10 ops · mixed`
- `2-2 digits · 4-6 ops · subtract`

## Generation requirements

Each generated worksheet item must:

- choose an operation count within the selected range
- choose operands whose displayed digit length stays within the selected digit range
- choose operators that comply with the selected operator mode
- produce a valid final answer
- remain suitable for worksheet presentation as a vertical sequence or ledger item

### Operator mode behavior

#### Addition-only

- all operations must be `+`

#### Subtraction-only

- all operations must be `-`
- generated chains must remain valid for the intended learner experience
- v1 should avoid negative final answers unless a later level explicitly opts in

#### Mixed

- each item may combine `+` and `-`
- exact sign patterns are not directly selected by the user in v1
- the generator may still emit patterns such as `+ +`, `- +`, `- - +`, or `+ - +`

## Digit certification

Digit certification exists so a worksheet labeled `3-4 digits` truly contains only operands in that range.

Certification rules:

- every operand in the drill must have a digit length between `minDigits` and `maxDigits`
- digit length is measured from the absolute displayed number, excluding any sign character
- leading zero operands are not allowed unless a later format explicitly supports them

Examples:

- `124`, `520`, and `9999` pass a `3-4 digits` profile
- `37` fails a `3-4 digits` profile

## Operation-count certification

Operation-count certification exists so a worksheet labeled `2-10 ops` can be trusted.

Certification rules:

- the count is the number of arithmetic operations after the starting value
- a chain like `205 + 16 + 19` has `2` operations
- a chain like `440 - 95 + 18` has `2` operations
- a chain with start plus ten following operators is the maximum allowed in v1

## Authored worksheet certification

Authored worksheet content should be allowed to declare the same worksheet profile metadata.

During build-time validation, authored worksheets must be checked for:

- operand digit compliance
- operation-count compliance
- operator-mode compliance
- label/profile consistency

If an authored worksheet item fails certification, the content validation step should fail with a clear message.

## UI requirements

The worksheet or practice UI should expose:

- digit range selector
- operation-count range selector
- operator mode selector
- a visible profile label on the generated worksheet/session

Example label format:

- `L3 mixed, sequence columns · 3-4 digits · 2-10 ops · mixed`

The visible label is part of certification because it makes the selected practice envelope explicit to the learner.

## Validation and test coverage

Add automated coverage for:

- profile object validation
- generated worksheet certification
- authored worksheet certification
- mixed-mode generation producing only `+` and `-`
- operation counts spanning low and high ends of the supported range
- digit-range compliance for `2-3` and `3-4` profiles

Suggested test cases:

1. generate `3-4 digits · 2-10 ops · mixed` and assert every operand and operation count is compliant
2. generate `2-3 digits · 2-3 ops · add` and assert every operator is `+`
3. generate `2-2 digits · 4-6 ops · subtract` and assert every operator is `-`
4. validate an authored worksheet that passes profile checks
5. validate an authored worksheet that includes a 2-digit operand inside a `3-4 digits` profile and fail clearly

## Implemented architecture

The current implementation:

1. keeps sequence-profile and worksheet-family helpers in `src/lib/worksheet.js`
2. certifies generated and authored sequence drills with normalized profile labels
3. certifies family questions recursively against canonical config, IDs, roles, techniques, operands, and recomputed answers
4. caches active questions by seed/config so presentation rerenders cannot silently rotate content
5. renders worksheet scoring, examples, and teacher keys from the certified structured questions

## Acceptance criteria

- a learner can request generated worksheet sessions with digit ranges like `2-3` or `3-4`
- a learner can request operation-count ranges from `2` through `10`
- a learner can choose `add`, `subtract`, or `mixed`
- generated output is certifiably compliant with the selected profile
- authored worksheets can declare and validate against the same profile model
- the UI shows the active worksheet profile label
- automated tests cover the certification rules
- worksheet-family questions stay within their separate 1-6 digit and 1-4 operation bounds
- additive, complement, multiplication, division, and anzan families reject shape, role, answer, technique, and identity tampering
