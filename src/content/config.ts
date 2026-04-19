import { defineCollection, z } from 'astro:content';
import { certifyWorksheetContentData } from '../lib/worksheet.js';

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
    skill: z.string(),
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
    skill: z.string(),
    difficulty: z.number().int().min(1).max(5),
    estimatedMinutes: z.number().int().positive(),
    type: z.string(),
    prerequisites: z.array(z.string()).default([]),
    hint: z.string(),
    answer: z.string(),
    explanation: z.string(),
    tags: z.array(z.string()).default([]),
    visualValue: z.number().int().nonnegative().optional(),
    stepValues: z.array(z.number().int().nonnegative()).default([]),
    worksheetProfile: worksheetProfileSchema.optional(),
    worksheetDrill: z.array(worksheetTermSchema).optional(),
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
