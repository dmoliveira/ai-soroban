import test from 'node:test';
import assert from 'node:assert/strict';

import { isReviewedContrastIncomplete } from './e2e/accessibility.js';

const finding = ({ target, html = '<span>Text</span>', messageKey, relatedTargets = [] }) => ({
  id: 'color-contrast',
  nodes: [{
    target: [target],
    html,
    any: [{
      id: 'color-contrast',
      data: { messageKey },
      relatedNodes: relatedTargets.map((relatedTarget) => ({ target: [relatedTarget] })),
    }],
    all: [],
    none: [],
  }],
});

test('reviewed axe contrast incompletes stay limited to exact known failure shapes', () => {
  assert.equal(isReviewedContrastIncomplete(finding({ target: '.panel-title', messageKey: 'bgGradient' })), true);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: '.brand > span:nth-child(2) > strong',
    html: '<strong>Soroban Dojo</strong>',
    messageKey: 'elmPartiallyObscured',
  })), true);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: '.unexpected-brand-target',
    html: '<strong>Soroban Dojo</strong>',
    messageKey: 'elmPartiallyObscured',
  })), false);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: '.nav-more > summary',
    html: '<summary>Explore more</summary>',
    messageKey: 'elmPartiallyObscured',
  })), true);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: '.unexpected-summary',
    html: '<summary>Explore more</summary>',
    messageKey: 'elmPartiallyObscured',
  })), false);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: 'a[aria-current="location"] > .jp-label > span',
    html: '<span>Train</span>',
    messageKey: 'elmPartiallyObscured',
  })), true);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: 'a[data-unexpected] > .jp-label > span',
    html: '<span>Train</span>',
    messageKey: 'elmPartiallyObscured',
  })), false);
  assert.equal(isReviewedContrastIncomplete(finding({
    target: '.nav-active.unexpected > .jp-label > small[lang="ja"]',
    html: '<small lang="ja">修練</small>',
    messageKey: 'elmPartiallyObscured',
  })), false);
  assert.equal(isReviewedContrastIncomplete(finding({ target: '#mini-game-score', html: '<span>0</span>', messageKey: 'shortTextContent' })), true);
  assert.equal(isReviewedContrastIncomplete(finding({ target: '#new-score', html: '<span>0</span>', messageKey: 'shortTextContent' })), false);
  assert.equal(isReviewedContrastIncomplete(finding({ target: 'h1', messageKey: 'pseudoContent', relatedTargets: ['.worksheet-hero'] })), true);
  assert.equal(isReviewedContrastIncomplete(finding({ target: 'h1', messageKey: 'pseudoContent', relatedTargets: ['.other-hero'] })), false);
  assert.equal(isReviewedContrastIncomplete(finding({ target: '.empty-state-mark', html: '<span>✦</span>', messageKey: 'nonBmp' })), true);
  assert.equal(isReviewedContrastIncomplete({ ...finding({ target: '.panel-title', messageKey: 'bgGradient' }), id: 'aria-prohibited-attr' }), false);
});
