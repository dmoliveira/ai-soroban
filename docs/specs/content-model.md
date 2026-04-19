# Content Model

## Lessons

Lessons are the source of truth for explanation and progression.

Required metadata:

- id
- title
- audience
- level
- skill
- estimatedMinutes
- prerequisites
- objectives
- relatedExercises
- nextLessons
- summary

## Exercises

Exercises are authored, not generated at runtime.

Required metadata:

- id
- title
- audience
- level
- skill
- difficulty
- estimatedMinutes
- type
- prerequisites
- hint
- answer
- explanation
- tags

## Worksheets

Worksheets may be generated at runtime or authored in content files, but both should share the same worksheet profile metadata.

Required worksheet profile metadata:

- profileId
- minDigits
- maxDigits
- minOperations
- maxOperations
- operatorMode
- label

Authored worksheets should also declare their drill items in a format that can be validated against the selected profile.
