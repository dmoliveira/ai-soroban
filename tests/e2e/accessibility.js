import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';

const WCAG_A_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const REVIEWED_CONTRAST_MESSAGE_KEYS = new Set(['bgGradient']);
const REVIEWED_SINGLE_VALUE_TARGETS = new Set([
  '.brand-mark',
  '#worksheet-answered',
  '#worksheet-correct',
  '#mini-game-score',
  '#mini-game-streak',
  '#completed-lessons',
  '#attempted-exercises',
  '#review-items',
  '#finished-sessions',
]);
const REVIEWED_BRAND_TEXT_TARGETS = new Set([
  'span:nth-child(2) > strong',
  '.brand > span:nth-child(2) > strong',
  'span:nth-child(2) > small',
  '.brand > span:nth-child(2) > small',
]);
const REVIEWED_NAV_PARENT_TARGETS = [
  'a[href$="start-here"]',
  'a[href$="curriculum"]',
  'a[href$="progress"]',
  'a[aria-current="page"]',
  'a[aria-current="location"]',
  'a[aria-label="Start · はじめ"]',
  'a[aria-label="Learn · 道筋"]',
  'a[aria-label="Train · 修練"]',
  'a[aria-label="Progress · 歩み"]',
  '.nav-active',
];
const REVIEWED_HEADER_OVERLAP_TARGETS = new Set([
  'label[for="theme-selector"]',
  'summary',
  '.nav-more > summary',
  ...REVIEWED_BRAND_TEXT_TARGETS,
  ...REVIEWED_NAV_PARENT_TARGETS.flatMap((parent) => [
    `${parent} > .jp-label > span`,
    `${parent} > .jp-label > small[lang="ja"]`,
  ]),
]);
const REVIEWED_CONTRAST_RATIONALE = 'Axe could not calculate contrast only for token-backed gradients, known layered header/worksheet surfaces, or known single-value/decorative text shapes; foreground and gradient-endpoint pairs are enforced by tests/theme-system.test.mjs.';

const attachmentName = (state) => `axe-${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const formatFinding = (kind, finding) => {
  const nodes = finding.nodes.map((node) => [
    `target: ${node.target.join(' > ')}`,
    `html: ${node.html}`,
    node.failureSummary,
    ...node.any.concat(node.all, node.none).map((check) => (
      `${check.data?.messageKey ? `[${check.data.messageKey}] ` : ''}${check.message}`
    )),
  ].filter(Boolean).join('\n    ')).join('\n  ');

  return `${kind} [${finding.impact || 'unknown impact'}] ${finding.id}: ${finding.help}\n${finding.helpUrl}\n  ${nodes}`;
};

const settleRenderedState = async (page) => {
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
};

const isReviewedHeaderOverlap = (node, check) => check.data?.messageKey === 'elmPartiallyObscured'
  && node.target.every((selector) => REVIEWED_HEADER_OVERLAP_TARGETS.has(selector)
    && (!(selector === 'summary' || selector === '.nav-more > summary') || node.html === '<summary>Explore more</summary>')
    && (!REVIEWED_BRAND_TEXT_TARGETS.has(selector)
      || node.html === '<strong>Soroban Dojo</strong>'
      || node.html === '<small>Small steps, steady hands · そろばん道場</small>'));

const isReviewedSingleValue = (node, check) => check.data?.messageKey === 'shortTextContent'
  && node.target.every((selector) => REVIEWED_SINGLE_VALUE_TARGETS.has(selector) || selector.endsWith('> .ledger-no'));

const isReviewedWorksheetHero = (check) => check.data?.messageKey === 'pseudoContent'
  && check.relatedNodes.some((related) => related.target.includes('.worksheet-hero'));

const isReviewedDecorativeMark = (node, check) => check.data?.messageKey === 'nonBmp'
  && node.target.every((selector) => selector.endsWith('.empty-state-mark'));

export const isReviewedContrastIncomplete = (finding) => finding.id === 'color-contrast'
  && finding.nodes.length > 0
  && finding.nodes.every((node) => {
    const checks = node.any.concat(node.all, node.none);
    return checks.length > 0 && checks.every((check) => (
      check.id === 'color-contrast'
      && (
        REVIEWED_CONTRAST_MESSAGE_KEYS.has(check.data?.messageKey)
        || isReviewedHeaderOverlap(node, check)
        || isReviewedSingleValue(node, check)
        || isReviewedWorksheetHero(check)
        || isReviewedDecorativeMark(node, check)
      )
    ));
  });

export const expectAccessibleState = async (page, testInfo, state) => {
  await settleRenderedState(page);

  const results = await new AxeBuilder({ page })
    .withTags(WCAG_A_AA_TAGS)
    .analyze();

  const reviewedIncomplete = results.incomplete.filter(isReviewedContrastIncomplete);
  const unresolvedIncomplete = results.incomplete.filter((finding) => !isReviewedContrastIncomplete(finding));
  const report = {
    ...results,
    accessibilityGateReview: {
      reviewedIncomplete: reviewedIncomplete.map((finding) => ({
        id: finding.id,
        rationale: REVIEWED_CONTRAST_RATIONALE,
      })),
      unresolvedIncomplete: unresolvedIncomplete.map((finding) => finding.id),
    },
  };

  await testInfo.attach(attachmentName(state), {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });

  const findings = [
    ...results.violations.map((finding) => formatFinding('violation', finding)),
    ...unresolvedIncomplete.map((finding) => formatFinding('incomplete', finding)),
  ];

  expect(findings, `${state} must have no WCAG A/AA violations or unresolved axe results`).toEqual([]);
};
