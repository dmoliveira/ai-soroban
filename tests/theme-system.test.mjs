import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_THEME_ID,
  THEMES,
  THEME_IDS,
  THEME_STORAGE_KEY,
  applyTheme,
  buildThemeCss,
  normalizeThemeId,
  readStoredTheme,
} from '../src/lib/themes.js';

const rgb = (hex) => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
};
const luminance = (hex) => {
  const channels = rgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};

test('theme registry exposes exactly three raw-string choices and a deterministic fallback', () => {
  assert.equal(THEME_STORAGE_KEY, 'soroban-dojo:theme');
  assert.equal(DEFAULT_THEME_ID, 'washi');
  assert.deepEqual(THEME_IDS, ['washi', 'sakura', 'sumi']);
  assert.equal(normalizeThemeId('sakura'), 'sakura');
  assert.equal(normalizeThemeId('"sakura"'), 'washi');
  assert.equal(normalizeThemeId('unknown'), 'washi');
  assert.equal(normalizeThemeId(null), 'washi');
  assert.equal(readStoredTheme({ getItem: () => 'sumi' }), 'sumi');
  assert.equal(readStoredTheme({ getItem: () => { throw new Error('blocked'); } }), 'washi');
});

test('every theme defines the identical deployed token schema', () => {
  const expected = Object.keys(THEMES[0].tokens).sort();
  THEMES.forEach((entry) => assert.deepEqual(Object.keys(entry.tokens).sort(), expected, entry.id));
  const css = buildThemeCss();
  THEME_IDS.forEach((id) => assert.match(css, new RegExp(`data-theme="${id}"`)));
  expected.forEach((token) => assert.match(css, new RegExp(`${token}:`)));
});

test('semantic text, action, focus, and control pairs meet contrast targets', () => {
  THEMES.forEach(({ id, tokens }) => {
    const pairs = [
      ['--ink', '--panel', 4.5],
      ['--muted', '--panel', 4.5],
      ['--accent', '--panel', 4.5],
      ['--on-accent', '--accent', 4.5],
      ['--on-action', '--action', 4.5],
      ['--control-line', '--panel', 3],
      ['--focus', '--bg', 3],
    ];
    pairs.forEach(([foreground, background, minimum]) => {
      assert.ok(contrast(tokens[foreground], tokens[background]) >= minimum, `${id}: ${foreground} on ${background}`);
    });
  });
});

test('applyTheme synchronizes root metadata without accepting unknown ids', () => {
  const attributes = {};
  const documentRef = {
    documentElement: { dataset: {}, style: {} },
    querySelector: () => ({ setAttribute: (name, value) => { attributes[name] = value; } }),
  };
  const selected = applyTheme(documentRef, 'sumi');
  assert.equal(selected.id, 'sumi');
  assert.equal(documentRef.documentElement.dataset.theme, 'sumi');
  assert.equal(documentRef.documentElement.style.colorScheme, 'dark');
  assert.equal(attributes.content, '#171716');
  assert.equal(applyTheme(documentRef, 'invalid').id, 'washi');
});
