import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { certifyWorksheetContentData } from './lib/worksheet.js';

const lessonIdSchema = z.string().regex(
  /^lesson-l[0-5]-\d{3}$/,
  'lesson IDs must use lesson-l0-001 through lesson-l5-999',
);
const exerciseIdSchema = z.string().regex(
  /^exercise-l[0-5]-\d{3}$/,
  'exercise IDs must use exercise-l0-001 through exercise-l5-999',
);

const skillSchema = z.enum([
  'abacus-orientation',
  'number-reading',
  'place-value',
  'number-setting',
  'addition',
  'subtraction',
  'complements',
  'mixed-operations',
  'multiplication',
  'division',
  'anzan',
  'mastery',
]);

const worksheetProfileSchema = z.object({
  digitRange: z.string(),
  operationRange: z.string(),
  operatorMode: z.enum(['add', 'subtract', 'mixed']),
  label: z.string().optional(),
});

const worksheetTermSchema = z.object({
  operator: z.enum(['+', '-']).nullable().optional(),
  value: z.number().int(),
});

const evaluationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('numeric'),
    accepted: z.array(z.number()).min(1),
    tolerance: z.number().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal('concepts'),
    allOf: z.array(z.array(z.string().min(1)).min(1)).min(1),
  }),
  z.object({
    kind: z.literal('pairs'),
    target: z.number().int(),
    pairs: z.array(z.tuple([z.number().int(), z.number().int()])).min(1),
  }),
  z.object({
    kind: z.literal('exact'),
    accepted: z.array(z.string().min(1)).min(1),
  }),
]);

const certifyWorksheetContent = (data: {
  worksheetProfile?: { digitRange: string; operationRange: string; operatorMode: 'add' | 'subtract' | 'mixed'; label?: string };
  worksheetDrill?: Array<{ operator?: '+' | '-' | null; value: number }>;
}) => certifyWorksheetContentData(data).valid;

const lessons = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/lessons' }),
  schema: z.object({
    id: lessonIdSchema,
    title: z.string(),
    audience: z.array(z.enum(['child', 'adult', 'both'])),
    level: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']),
    skill: skillSchema,
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(lessonIdSchema).default([]),
    objectives: z.array(z.string()).min(1),
    relatedExercises: z.array(exerciseIdSchema).default([]),
    nextLessons: z.array(lessonIdSchema).default([]),
    summary: z.string(),
    visualValue: z.number().int().nonnegative().optional(),
    stepValues: z.array(z.number().int().nonnegative()).default([]),
  }),
});

const exercises = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/exercises' }),
  schema: z.object({
    id: exerciseIdSchema,
    title: z.string(),
    audience: z.array(z.enum(['child', 'adult', 'both'])),
    level: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']),
    skill: skillSchema,
    difficulty: z.number().int().min(1).max(5),
    estimatedMinutes: z.number().int().positive(),
    type: z.string(),
    prerequisites: z.array(lessonIdSchema).default([]),
    hint: z.string(),
    answer: z.string(),
    expectedValue: z.number().optional(),
    evaluation: evaluationSchema.optional(),
    explanation: z.string(),
    tags: z.array(z.string()).default([]),
    visualValue: z.number().int().nonnegative().optional(),
    stepValues: z.array(z.number().int().nonnegative()).default([]),
    worksheetProfile: worksheetProfileSchema.optional(),
    worksheetDrill: z.array(worksheetTermSchema).optional(),
  }).superRefine((data, context) => {
    if (data.expectedValue === undefined && !data.evaluation) {
      context.addIssue({ code: 'custom', message: 'nonnumeric exercises require structured evaluation metadata', path: ['evaluation'] });
    }
  }).refine(certifyWorksheetContent, {
    message: 'worksheetProfile and worksheetDrill must exist together, comply with the declared worksheet profile, and use the normalized label',
  }),
});

const references = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/references' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
  }),
});

export const collections = { lessons, exercises, references };
