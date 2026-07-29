import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { STORAGE_KEYS, readStoredArray, writeStoredJson } from '../src/lib/storage.js';
import { ensureStorageCompatibility } from '../src/lib/storage-migrations.js';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const packageJson = JSON.parse(read('package.json'));
const packageLock = JSON.parse(read('package-lock.json'));

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

const indentation = (line) => line.match(/^ */)[0].length;
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const workflowBlock = (source, header, indent, { listItem = false } = {}) => {
  const lines = source.split(/\r?\n/);
  const prefix = ' '.repeat(indent);
  const marker = listItem ? `${prefix}- name: ${header}` : `${prefix}${header}:`;
  const start = lines.findIndex((line) => line === marker || (!listItem && line.startsWith(`${marker} `)));
  assert.notEqual(start, -1, `missing workflow block: ${header}`);

  let end = start + 1;
  while (end < lines.length) {
    const line = lines[end];
    if (line.trim() && indentation(line) <= indent) break;
    end += 1;
  }
  return lines.slice(start, end).join('\n');
};

const workflowValue = (source, key, indent) => {
  const pattern = new RegExp(`^${' '.repeat(indent)}${escapePattern(key)}:\\s*(.+)$`, 'm');
  const match = source.match(pattern);
  assert.ok(match, `missing workflow value: ${key}`);
  return match[1].trim();
};

const workflowStep = (job, name) => workflowBlock(job, name, 6, { listItem: true });

test('0.4 release metadata and learner notes stay aligned', () => {
  assert.equal(packageJson.version, '0.4.0');
  assert.equal(packageLock.version, packageJson.version);
  assert.equal(packageLock.packages[''].version, packageJson.version);
  assert.equal(packageJson.engines.node, '>=22.12.0');
  assert.equal(packageJson.engines.npm, '>=9.6.5');
  assert.equal(packageJson.dependencies.astro, '^7.1.5');
  assert.equal(packageJson.dependencies['@astrojs/check'], '^0.9.10');
  assert.equal(packageJson.dependencies.zod, undefined);
  assert.equal(packageLock.packages[''].dependencies.zod, undefined);
  assert.equal(packageJson.scripts['audit:dependencies'], 'npm audit --audit-level=high');

  const releases = read('src/pages/releases.astro');
  const current = releases.indexOf("version: '0.4.0'");
  const previous = releases.indexOf("version: '0.3.0'");
  assert.ok(current >= 0 && previous > current, '0.4.0 must be the first release entry');
  [
    'prospective first-check evidence',
    'additive, complement, multiplication, division, and anzan worksheet families',
    'Ten Bridge',
    'Bead Builder',
    'live practice session',
    'deployed-release checks',
  ].forEach((claim) => assert.ok(releases.includes(claim), `missing release claim: ${claim}`));

  const readme = read('README.md');
  assert.match(readme, /Soroban Dojo 0\.4\.0 adds prospective first-check evidence/);
  assert.match(readme, /npm run test:release/);
  assert.match(readme, /npm run test:e2e:release-smoke/);
  assert.match(readme, /Reading legacy route or placement state never rewrites it/);
});

test('public privacy and worksheet docs match the shipped 0.4 boundaries', () => {
  const privacyPage = read('src/pages/privacy.astro');
  assert.match(privacyPage, /Earlier activity can remain visible for continuity/);
  assert.match(privacyPage, /does not upgrade it into verified mastery/);
  assert.match(privacyPage, /0\.4 versioned evidence, score, or provenance record cannot be validated/);
  assert.match(privacyPage, /Other malformed local records use safe read-time fallbacks/);
  assert.match(privacyPage, /clear only the selected learner route/);
  assert.match(privacyPage, /without erasing other progress/);

  const privacySpec = read('docs/specs/privacy-and-data.md');
  assert.match(privacySpec, /pre-0\.4 records/);
  assert.match(privacySpec, /Bead Builder's in-progress rod state are not persisted/);
  assert.match(privacySpec, /legacy raw-string storage format/);
  assert.match(privacySpec, /Reading either value must not normalize or rewrite saved bytes/);

  const malformedEvidence = '"unknown-shape"';
  const malformed = new MemoryStorage({
    [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 1 }),
    [STORAGE_KEYS.masteryEvidence]: malformedEvidence,
  });
  const rejected = ensureStorageCompatibility(malformed);
  assert.equal(rejected.writable, false);
  assert.equal(rejected.failedKey, STORAGE_KEYS.masteryEvidence);
  assert.equal(writeStoredJson(malformed, STORAGE_KEYS.completedLessons, ['forged']), false);
  assert.equal(malformed.getItem(STORAGE_KEYS.masteryEvidence), malformedEvidence);

  const future = new MemoryStorage({
    [STORAGE_KEYS.stateSchema]: JSON.stringify({ version: 99 }),
    [STORAGE_KEYS.miniGameScoresV2]: '{"version":99,"opaque":true}',
  });
  const futureSnapshot = Object.fromEntries(future.values);
  const futureResult = ensureStorageCompatibility(future);
  assert.equal(futureResult.future, true);
  assert.equal(futureResult.writable, false);
  assert.equal(writeStoredJson(future, STORAGE_KEYS.miniGameScoresV2, { version: 2 }), false);
  assert.deepEqual(Object.fromEntries(future.values), futureSnapshot);

  const malformedLegacy = new MemoryStorage({ [STORAGE_KEYS.completedLessons]: '{broken' });
  assert.deepEqual(readStoredArray(malformedLegacy, STORAGE_KEYS.completedLessons), []);

  const worksheetSpec = read('docs/specs/worksheet-generator.md');
  assert.match(worksheetSpec, /Certified worksheet-family v1/);
  assert.match(worksheetSpec, /five certified families: `additive`, `complement`, `multiplication`, `division`, and `anzan`/);
  assert.match(worksheetSpec, /digit bands are ordered ranges from 1 through 6 digits/);
  assert.match(worksheetSpec, /operation bounds are ordered integers from 1 through 4/);
  assert.match(worksheetSpec, /sequence-profile rules below/);

  const contentSpec = read('docs/specs/content-model.md');
  assert.match(contentSpec, /src\/content\.config\.ts/);
  assert.match(contentSpec, /npm run test:content-build/);

  const playwrightConfig = read('playwright.config.js');
  assert.match(playwrightConfig, /node \.\/node_modules\/astro\/bin\/astro\.mjs/);
  assert.match(playwrightConfig, /ASTRO_DEV_BACKGROUND: '0'/);
});

test('CI and Pages use Node 24-compatible actions and enforce the release gate', () => {
  assert.equal(
    packageJson.scripts['test:e2e:release-smoke'],
    'playwright test tests/e2e/release-smoke.spec.js --project=chromium --reporter=line --workers=1 --retries=0',
  );

  const ci = read('.github/workflows/ci.yml');
  assert.equal(workflowValue(ci, 'contents', 2), 'read');
  const validate = workflowBlock(ci, 'validate', 2);
  assert.equal(workflowValue(workflowStep(validate, 'Checkout'), 'uses', 8), 'actions/checkout@v7');
  assert.equal(workflowValue(workflowStep(validate, 'Setup Node'), 'uses', 8), 'actions/setup-node@v7');
  assert.equal(workflowValue(workflowStep(validate, 'Setup Node'), 'node-version', 10), '22');
  assert.equal(workflowValue(workflowStep(validate, 'Audit dependency baseline'), 'run', 8), 'npm run audit:dependencies');
  assert.equal(workflowValue(workflowStep(validate, 'Verify release contract'), 'run', 8), 'npm run test:release');
  assert.equal(workflowValue(workflowStep(validate, 'Verify built content routes'), 'run', 8), 'npm run test:content-build');
  assert.equal(
    workflowValue(workflowStep(validate, 'Run local browser tests'), 'run', 8),
    'PLAYWRIGHT_SERVER_MODE=preview npm run test:e2e',
  );
  assert.equal(workflowValue(workflowStep(validate, 'Upload browser diagnostics'), 'uses', 8), 'actions/upload-artifact@v7');

  const pages = read('.github/workflows/deploy-pages.yml');
  assert.equal(workflowValue(pages, 'permissions', 0), '{}');
  assert.equal(
    workflowValue(workflowBlock(pages, 'concurrency', 0), 'group', 2),
    'pages-${{ github.workflow }}-${{ github.ref }}',
  );

  const build = workflowBlock(pages, 'build', 2);
  assert.equal(workflowValue(build, 'if', 4), "${{ github.ref == 'refs/heads/main' }}");
  const buildPermissions = workflowBlock(build, 'permissions', 4);
  assert.equal(workflowValue(buildPermissions, 'contents', 6), 'read');
  assert.equal(workflowValue(workflowStep(build, 'Checkout'), 'uses', 8), 'actions/checkout@v7');
  assert.equal(workflowValue(workflowStep(build, 'Setup Node'), 'uses', 8), 'actions/setup-node@v7');
  assert.equal(workflowValue(workflowStep(build, 'Setup Node'), 'node-version', 10), '22');
  assert.equal(workflowValue(workflowStep(build, 'Setup Pages'), 'uses', 8), 'actions/configure-pages@v6');
  assert.equal(workflowValue(workflowStep(build, 'Audit dependency baseline'), 'run', 8), 'npm run audit:dependencies');
  assert.equal(workflowValue(workflowStep(build, 'Verify built content routes'), 'run', 8), 'npm run test:content-build');
  assert.equal(
    workflowValue(workflowStep(build, 'Validate browser flows'), 'run', 8),
    'PLAYWRIGHT_SERVER_MODE=preview npm run test:e2e',
  );
  assert.equal(workflowValue(workflowStep(build, 'Upload Pages artifact'), 'uses', 8), 'actions/upload-pages-artifact@v5');

  const deploy = workflowBlock(pages, 'deploy', 2);
  assert.equal(workflowValue(deploy, 'if', 4), "${{ github.ref == 'refs/heads/main' }}");
  const deployPermissions = workflowBlock(deploy, 'permissions', 4);
  assert.equal(workflowValue(deployPermissions, 'pages', 6), 'write');
  assert.equal(workflowValue(deployPermissions, 'id-token', 6), 'write');
  assert.equal(workflowValue(deploy, 'needs', 4), 'build');
  assert.equal(workflowValue(workflowBlock(deploy, 'outputs', 4), 'page_url', 6), '${{ steps.deployment.outputs.page_url }}');
  const deployment = workflowStep(deploy, 'Deploy to GitHub Pages');
  assert.equal(workflowValue(deployment, 'id', 8), 'deployment');
  assert.equal(workflowValue(deployment, 'uses', 8), 'actions/deploy-pages@v5');

  const releaseSmoke = workflowBlock(pages, 'release-smoke', 2);
  assert.equal(workflowValue(releaseSmoke, 'needs', 4), 'deploy');
  assert.equal(workflowValue(releaseSmoke, 'if', 4), "${{ needs.deploy.result == 'success' && needs.deploy.outputs.page_url != '' }}");
  assert.equal(workflowValue(releaseSmoke, 'timeout-minutes', 4), '10');
  assert.equal(workflowValue(workflowBlock(releaseSmoke, 'permissions', 4), 'contents', 6), 'read');
  assert.equal(
    workflowValue(workflowBlock(releaseSmoke, 'env', 4), 'PLAYWRIGHT_BASE_URL', 6),
    '${{ needs.deploy.outputs.page_url }}',
  );
  assert.equal(workflowValue(workflowStep(releaseSmoke, 'Checkout'), 'uses', 8), 'actions/checkout@v7');
  assert.equal(workflowValue(workflowStep(releaseSmoke, 'Setup Node'), 'uses', 8), 'actions/setup-node@v7');
  assert.equal(workflowValue(workflowStep(releaseSmoke, 'Setup Node'), 'node-version', 10), '22');
  assert.equal(workflowValue(workflowStep(releaseSmoke, 'Smoke deployed release'), 'run', 8), 'npm run test:e2e:release-smoke');
});
