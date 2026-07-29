import { defineCollection, z } from 'astro:content';
import { certifyWorksheetContentData } from '../lib/worksheet.js';

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
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    audience: z.array(z.enum(['child', 'adult', 'both'])),
    level: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']),
    skill: skillSchema,
    estimatedMinutes: z.number().int().positive(),
    prerequisites: z.array(z.string()).default([]),
    objectives: z.array(z.string()).min(1),
    relatedExercises: z.array(z.string()).default([]),
    nextLessons: z.array(z.string()).default([]),
    summary: z.string(),
    visualValue: z.number().int().nonnegative().optional(),
    stepValues: z.array(z.number().int().nonnegative()).default([]),
  }),
});

const exercises = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    audience: z.array(z.enum(['child', 'adult', 'both'])),
    level: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5']),
    skill: skillSchema,
    difficulty: z.number().int().min(1).max(5),
    estimatedMinutes: z.number().int().positive(),
    type: z.string(),
    prerequisites: z.array(z.string()).default([]),
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
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'nonnumeric exercises require structured evaluation metadata', path: ['evaluation'] });
    }
  }).refine(certifyWorksheetContent, {
    message: 'worksheetProfile and worksheetDrill must exist together, comply with the declared worksheet profile, and use the normalized label',
  }),
});

const references = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
  }),
});

export const collections = { lessons, exercises, references };
