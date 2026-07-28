import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const htmlFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const resolved = path.join(directory, entry.name);
  return entry.isDirectory() ? htmlFiles(resolved) : resolved.endsWith('.html') ? [resolved] : [];
});

test('every built page installs the validated theme before its stylesheet', () => {
  assert.equal(fs.existsSync(dist), true, 'run npm run build first');
  const files = htmlFiles(dist);
  assert.ok(files.length >= 90, `expected the complete static site, found ${files.length} HTML files`);
  files.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /<html[^>]*data-theme="washi"/);
    assert.match(html, /<meta name="theme-color" content="#F5F0E7">/);
    const bootstrap = html.indexOf('soroban-dojo:theme');
    const themeCss = html.indexOf('data-theme="sumi"');
    const stylesheet = html.indexOf('<link rel="stylesheet"');
    assert.ok(bootstrap >= 0, `${file}: missing bootstrap`);
    assert.ok(themeCss > bootstrap, `${file}: missing inline theme CSS after bootstrap`);
    assert.ok(stylesheet === -1 || bootstrap < stylesheet, `${file}: bootstrap must precede stylesheet`);
  });
});
