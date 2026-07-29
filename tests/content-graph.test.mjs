import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const contentRoot = fileURLToPath(new URL('../src/content/', import.meta.url));
const lessonIdPattern = /^lesson-l[0-5]-(?!000)\d{3}$/;
const exerciseIdPattern = /^exercise-l[0-5]-(?!000)\d{3}$/;

const markdownFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  }));
  return nested.flat();
};

const parseFrontmatter = async (path) => {
  const source = await readFile(path, 'utf8');
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(match, `${path} must begin with YAML frontmatter`);
  const lines = match[1].split('\n');
  const scalar = (key) => lines.find((line) => line.startsWith(`${key}:`))?.slice(key.length + 1).trim() || '';
  const list = (key) => {
    const start = lines.findIndex((line) => line === `${key}:`);
    if (start === -1) return [];
    const values = [];
    for (const line of lines.slice(start + 1)) {
      const item = line.match(/^\s+-\s+(.+)$/);
      if (!item) break;
      values.push(item[1].trim());
    }
    return values;
  };
  return {
    path,
    id: scalar('id'),
    prerequisites: list('prerequisites'),
    relatedExercises: list('relatedExercises'),
    nextLessons: list('nextLessons'),
  };
};

test('content id patterns reserve sequence zero', () => {
  assert.match('lesson-l0-001', lessonIdPattern);
  assert.match('lesson-l5-999', lessonIdPattern);
  assert.doesNotMatch('lesson-l0-000', lessonIdPattern);
  assert.match('exercise-l0-001', exerciseIdPattern);
  assert.match('exercise-l5-999', exerciseIdPattern);
  assert.doesNotMatch('exercise-l0-000', exerciseIdPattern);
});

test('lesson and exercise ids are unique and every content link resolves', async () => {
  const lessonPaths = await markdownFiles(join(contentRoot, 'lessons'));
  const exercisePaths = await markdownFiles(join(contentRoot, 'exercises'));
  const lessons = await Promise.all(lessonPaths.map(parseFrontmatter));
  const exercises = await Promise.all(exercisePaths.map(parseFrontmatter));
  const all = [...lessons, ...exercises];
  const ids = all.map((entry) => entry.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

  assert.equal(ids.every(Boolean), true, 'every lesson and exercise needs an id');
  assert.deepEqual([...new Set(duplicates)], [], `duplicate content ids: ${duplicates.join(', ')}`);
  lessons.forEach((entry) => assert.match(entry.id, lessonIdPattern, `${entry.path} has an unsafe lesson id`));
  exercises.forEach((entry) => assert.match(entry.id, exerciseIdPattern, `${entry.path} has an unsafe exercise id`));

  const lessonIds = new Set(lessons.map((entry) => entry.id));
  const exerciseIds = new Set(exercises.map((entry) => entry.id));
  lessons.forEach((entry) => {
    entry.prerequisites.forEach((id) => assert.ok(lessonIds.has(id), `${entry.path} has unknown prerequisite ${id}`));
    entry.nextLessons.forEach((id) => assert.ok(lessonIds.has(id), `${entry.path} has unknown next lesson ${id}`));
    entry.relatedExercises.forEach((id) => assert.ok(exerciseIds.has(id), `${entry.path} has unknown related exercise ${id}`));
  });
  exercises.forEach((entry) => {
    entry.prerequisites.forEach((id) => assert.ok(lessonIds.has(id), `${entry.path} has unknown prerequisite ${id}`));
  });
});
