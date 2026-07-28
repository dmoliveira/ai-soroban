export const LEVELS = [
  { id: 'L0', name: 'Foundations', focus: 'orientation, reading numbers, first movements' },
  { id: 'L1', name: 'Beginner', focus: 'guided addition and subtraction' },
  { id: 'L2', name: 'Basic Operations', focus: 'complements and steadier drill work' },
  { id: 'L3', name: 'Intermediate', focus: 'mixed operations and faster accuracy' },
  { id: 'L4', name: 'Advanced', focus: 'complex drills, pacing, independence' },
  { id: 'L5', name: 'Mastery', focus: 'mental soroban and refinement' },
];

export const PATHS = [
  {
    id: 'children',
    title: 'Children Path',
    summary: 'Shorter lessons, visual language, and gentle encouragement for younger learners.',
  },
  {
    id: 'adults',
    title: 'Adult Path',
    summary: 'Structured self-study, direct explanations, and consistent practice planning.',
  },
];

export { PROGRESS_STORAGE_KEYS, STORAGE_KEYS } from './storage.js';
