/**
 * Labelled-corpus quality gates.
 *
 * These are the only tests that assert detection *quality* rather than
 * mechanism. They are deliberately coarse: a drop below the gate means the
 * engine regressed on realistic mail, not that a unit changed.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { heuristicDetect } = require('../src/utils/heuristic-detector.js');
const { PHISH, HAM, toEmail } = require('./helpers/fixtures.js');

const RECALL_GATE = 0.75;
const FPR_GATE = 0.25;

function evaluate(samples) {
  return samples.map((sample) => ({
    sample,
    label: heuristicDetect(toEmail(sample)).label,
  }));
}

describe('corpus evaluation', () => {
  test('recall >= 0.75 on phishing samples', () => {
    const results = evaluate(PHISH);
    const hits = results.filter((r) => r.label === 'phishing_email').length;
    const recall = hits / PHISH.length;

    const missed = results.filter((r) => r.label !== 'phishing_email');
    assert.ok(
      recall >= RECALL_GATE,
      `recall ${(recall * 100).toFixed(0)}% below gate ${RECALL_GATE * 100}%\n` +
        `missed: ${missed.map((m) => m.sample.subject).join(' | ')}`
    );
  });

  test('false-positive rate <= 0.25 on ham samples', () => {
    const results = evaluate(HAM);
    const falsePositives = results.filter((r) => r.label === 'phishing_email').length;
    const fpr = falsePositives / HAM.length;

    const flagged = results.filter((r) => r.label === 'phishing_email');
    assert.ok(
      fpr <= FPR_GATE,
      `FPR ${(fpr * 100).toFixed(0)}% above gate ${FPR_GATE * 100}%\n` +
        `flagged: ${flagged.map((f) => f.sample.subject).join(' | ')}`
    );
  });

  test('every sample is classified as one of the known labels', () => {
    const known = new Set(['phishing_email', 'legitimate_email', 'uncertain']);
    for (const r of [...evaluate(PHISH), ...evaluate(HAM)]) {
      assert.ok(known.has(r.label), `unexpected label "${r.label}" for "${r.sample.subject}"`);
    }
  });

  test('every phishing sample yields at least one reason', () => {
    for (const sample of PHISH) {
      const res = heuristicDetect(toEmail(sample));
      assert.ok(res.reasons.length > 0, `"${sample.subject}" produced no reasons`);
    }
  });

  test('corpus is large enough to be meaningful', () => {
    assert.ok(PHISH.length >= 8, 'phishing corpus too small');
    assert.ok(HAM.length >= 8, 'ham corpus too small');
  });
});