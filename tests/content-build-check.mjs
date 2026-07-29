import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import astroConfig from '../astro.config.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');
const configuredBase = astroConfig.base?.endsWith('/') ? astroConfig.base : `${astroConfig.base}/`;
const deployedBase = new URL(configuredBase, astroConfig.site).toString();
const contentRoutePattern = /^l[0-5]\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const markdownRoutes = async (collection) => {
  const base = join(root, 'src', 'content', collection);
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    const routes = await Promise.all(entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return walk(path);
      if (entry.name.startsWith('_') || !entry.name.endsWith('.md')) return [];
      return [relative(base, path).split(sep).join('/').replace(/\.md$/, '')];
    }));
    return routes.flat();
  };
  return walk(base);
};

test('the static build preserves every content route and canonical sitemap URL', async () => {
  const [lessonRoutes, exerciseRoutes, sitemap] = await Promise.all([
    markdownRoutes('lessons'),
    markdownRoutes('exercises'),
    readFile(join(dist, 'sitemap.xml'), 'utf8'),
  ]);

  assert.doesNotMatch(sitemap, /dmoliveira\.github\.io\/ai-soroban/);
  for (const [collection, routes] of [['lessons', lessonRoutes], ['exercises', exerciseRoutes]]) {
    for (const route of routes) {
      assert.match(route, contentRoutePattern, `unsafe ${collection} route: ${route}`);
      const output = join(dist, collection, route, 'index.html');
      assert.equal((await stat(output)).isFile(), true, `missing built route: ${collection}/${route}`);
      assert.match(sitemap, new RegExp(`<loc>${deployedBase}${collection}/${route}/</loc>`));
    }
  }

  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(locations).size, locations.length, 'sitemap URLs must stay unique');
});

test('the built lesson bootstrap receives only the validated content id', async () => {
  const lesson = await readFile(join(dist, 'lessons', 'l0', 'parts-of-the-soroban', 'index.html'), 'utf8');
  assert.match(lesson, /const lessonId\s*=\s*["']lesson-l0-001["']/);
});
