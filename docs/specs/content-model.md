# Content Model

## Source of truth

Astro content collections in `src/content/` provide authored lessons, exercises, and references. Runtime-generated practice and worksheets supplement authored content; they do not replace the curriculum graph.

## Shared rules

- IDs are unique across lessons and exercises.
- Every prerequisite, related exercise, and next lesson resolves to a real content ID.
- Levels use `L0` through `L5`.
- Skills use the enum in `src/content/config.ts`; free-form spellings are not accepted.
- `npm test` validates graph integrity and `npm run check` validates collection schemas.

## Lessons

Required metadata:

- `id`, `title`, `audience`, `level`, and `skill`
- `estimatedMinutes`, `summary`, and at least one objective
- `prerequisites`, `relatedExercises`, and `nextLessons` (empty lists are valid)

Optional visual metadata can declare a non-negative `visualValue` and `stepValues`.

## Exercises

Authored exercises define a focused attempt and explanation. Required metadata includes:

- `id`, `title`, `audience`, `level`, `skill`, and `type`
- difficulty from 1 through 5 and a positive estimated time
- prerequisites, hint, answer, explanation, and tags

Numeric exercises may include `expectedValue`; visual exercises may include `visualValue` and `stepValues`.

## Generated practice

Generated sessions carry a level, source, format, question style, term count, check mode, optional timer, stable session ID, responses, and final score. Generated algorithms must be deterministic when supplied a seed and must expose truthful mode-specific rules.

Challenge sessions add a versioned challenge identity, seed, exact target and rule snapshots, structured question data, and a measured outcome. The generator certifies coverage and recomputed answers before persistence. Challenge outcomes count only first-check numeric answers without hints, reveals, or recovery; they never trust a mutable `correct` flag.

## Mini-games

Mini-games build their full question queue or Flash Anzan term sequence from a seed before play. Settings are normalized to bounded choices. Number Bond Blitz defaults to 10 questions and 30 seconds and also offers an untimed finite queue; Flash Anzan defaults to 20 terms at 1,000 milliseconds per term and links to untimed mental practice.

Every game has a finite terminal state. Natural completion records the best score and medal under the existing game ID; Stop or hidden-page interruption reports partial score and elapsed time without replacing a best. Replay keeps the selected settings and creates a fresh seed.

## Worksheets

Generated and authored worksheet drills share a normalized profile:

- digit and operation ranges
- `add`, `subtract`, or `mixed` operator mode
- normalized visible label

Authored `worksheetDrill` terms are certified against the declared profile at build time. See `worksheet-generator.md` for algorithm constraints.
