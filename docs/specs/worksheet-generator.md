# Worksheet Generator Specification

## Goal

Expand worksheet and drill generation so Soroban Dojo can produce and certify multi-step arithmetic practice beyond the current 1-step generated drills.

The first target is to support:

- 2-digit through 4-digit arithmetic profiles such as `2-3 digits` and `3-4 digits`
- operation-count ranges from `2` through `10`
- simple operator modes: addition-only, subtraction-only, and mixed
- profile certification for both generated and authored worksheets
- visible worksheet profile labels such as `3-4 digits · 2-10 ops · mixed`

## Current gap

The current generated practice flow only supports:

- simple 2-digit reading prompts
- one-step addition or subtraction prompts
- complement-to-10 prompts

This does not yet cover worksheet-style vertical arithmetic or configurable operation chains.

## Scope

Phase order:

1. apply the config model to generated drill sessions
2. apply the same profile model to authored worksheet content

In scope:

- generated practice sessions
- authored worksheet metadata and validation
- worksheet profile labels in the UI
- validator/test coverage for profile compliance

Out of scope for v1:

- user-authored exact sign templates such as a custom literal `+ - + -`
- multiplication and division
- adaptive difficulty based on performance

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

## Implementation notes

Recommended implementation path:

1. extract generated arithmetic logic from `PracticeClient.astro` into a focused worksheet generator module
2. define normalized worksheet profile types and helpers
3. add a `certifyWorksheetProfile()` validator for generated and authored items
4. connect the new selectors and visible label in the practice UI
5. extend authored worksheet content metadata to opt into the same profile model

## Acceptance criteria

- a learner can request generated worksheet sessions with digit ranges like `2-3` or `3-4`
- a learner can request operation-count ranges from `2` through `10`
- a learner can choose `add`, `subtract`, or `mixed`
- generated output is certifiably compliant with the selected profile
- authored worksheets can declare and validate against the same profile model
- the UI shows the active worksheet profile label
- automated tests cover the certification rules
