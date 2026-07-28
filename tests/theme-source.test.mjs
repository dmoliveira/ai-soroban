import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { THEMES } from '../src/lib/themes.js';

const root = path.resolve(import.meta.dirname, '..');
const walk = (directory, predicate) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const resolved = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(resolved, predicate) : predicate(resolved) ? [resolved] : [];
});
const sourceFiles = walk(path.join(root, 'src'), (file) => /\.(astro|css)$/.test(file));
const colorPattern = /#[0-9a-f]{3}(?:[0-9a-f]{3})?(?:[0-9a-f]{2})?\b|rgba?\(|hsla?\(|\b(?:white|black)\b/i;
const declarationValues = (css) => [...css.matchAll(/(?:^|[;{])\s*(?:--[\w-]+|[\w-]+)\s*:\s*([^;}]*)/gm)].map((match) => match[1]);

test('theme colors live only in the registry or the exact neutral print block', () => {
  const findings = [];
  sourceFiles.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('global.css')) {
      const nonPrint = source.split('@media print {')[0];
      declarationValues(nonPrint).forEach((value) => {
        if (colorPattern.test(value)) findings.push(`${path.relative(root, file)}: ${value.trim()}`);
      });
      return;
    }
    if (!file.endsWith('.astro')) return;
    const cssBlocks = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
    const inlineStyles = [...source.matchAll(/style=\{?`([\s\S]*?)`\}?/g)].map((match) => match[1]);
    [...cssBlocks, ...inlineStyles].flatMap(declarationValues).forEach((value) => {
      if (colorPattern.test(value)) findings.push(`${path.relative(root, file)}: ${value.trim()}`);
    });
  });
  assert.deepEqual(findings, []);
});

test('every CSS variable use resolves to a registry or source definition', () => {
  const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const definitions = new Set(Object.keys(THEMES[0].tokens));
  for (const match of source.matchAll(/(--[\w-]+)\s*:/g)) definitions.add(match[1]);
  const usages = new Set([...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]));
  assert.deepEqual([...usages].filter((name) => !definitions.has(name)).sort(), []);
});

test('fixed-color SVG exceptions stay narrow and explicit', () => {
  const svgFiles = walk(path.join(root, 'public'), (file) => file.endsWith('.svg'));
  const filesWithColors = svgFiles.filter((file) => colorPattern.test(fs.readFileSync(file, 'utf8')));
  const allowed = [
    'public/favicon.svg',
    'public/graphics/sakura-mark.svg',
    'public/graphics/worksheet-mist.svg',
  ];
  assert.deepEqual(filesWithColors.map((file) => path.relative(root, file)).sort(), allowed.sort());
});

test('every Sakura decoration opts into shared theme and print treatment', () => {
  const findings = [];
  sourceFiles.filter((file) => file.endsWith('.astro')).forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<img\b[^>]*sakura-mark\.svg[^>]*>/g)) {
      if (!/class=["'][^"']*\btheme-decoration\b/.test(match[0])) {
        findings.push(path.relative(root, file));
      }
    }
  });
  assert.deepEqual(findings, []);
});
