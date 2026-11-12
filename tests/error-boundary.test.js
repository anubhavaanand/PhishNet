/**
 * Error-boundary utility tests: DOM safety, retry, and message helpers.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  withErrorBoundary,
  retryWithBackoff,
  safeQuery,
  safeText,
  safeAttr,
  debounce,
  throttle,
  generateId,
  isVisible,
} = require('../src/utils/error-boundary.js');

// isVisible() reads window.getComputedStyle, so give it a minimal window.
globalThis.window = {
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
};

describe('withErrorBoundary', () => {
  test('returns the wrapped result on success', async () => {
    const fn = withErrorBoundary(async (a, b) => a + b, 'add');
    assert.equal(await fn(2, 3), 5);
  });

  test('converts a throw into a structured failure', async () => {
    const fn = withErrorBoundary(async () => { throw new Error('boom'); }, 'risky');
    const res = await fn();
    assert.equal(res.failed, true);
    assert.equal(res.error, 'boom');
  });
});

describe('retryWithBackoff', () => {
  test('resolves without retrying when the first attempt succeeds', async () => {
    let calls = 0;
    const value = await retryWithBackoff(async () => { calls++; return 'ok'; }, 3, 1);
    assert.equal(value, 'ok');
    assert.equal(calls, 1);
  });

  test('retries until success', async () => {
    let calls = 0;
    const value = await retryWithBackoff(async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return 'ok';
    }, 3, 1);
    assert.equal(value, 'ok');
    assert.equal(calls, 3);
  });

  test('rethrows after exhausting attempts', async () => {
    let calls = 0;
    await assert.rejects(
      retryWithBackoff(async () => { calls++; throw new Error('always'); }, 2, 1),
      /always/
    );
    assert.equal(calls, 2);
  });
});

describe('safe DOM helpers', () => {
  test('safeText trims and caps length', () => {
    assert.equal(safeText({ textContent: '  test  ' }), 'test');
    const long = safeText({ textContent: 'x'.repeat(5000) }, 10);
    assert.equal(long.length, 10);
  });

  test('safeText returns empty string for nullish input', () => {
    assert.equal(safeText(null), '');
  });

  test('safeAttr returns the attribute or a fallback', () => {
    assert.equal(safeAttr({ getAttribute: () => 'https://x.test' }, 'href'), 'https://x.test');
    assert.equal(safeAttr(null, 'href', 'fallback'), 'fallback');
    assert.equal(safeAttr({}, 'href', 'fallback'), 'fallback');
  });

  test('safeQuery returns null for a missing element', () => {
    assert.equal(safeQuery(null, 'div'), null);
  });

  test('safeQuery tries each selector in order', () => {
    const el = { querySelector: (sel) => (sel === '.second' ? { tag: 'second' } : null) };
    assert.equal(safeQuery(el, ['.first', '.second']).tag, 'second');
  });

  test('safeQuery swallows invalid selectors and keeps trying', () => {
    const el = {
      querySelector(sel) {
        if (sel === '<<<invalid>>>') throw new Error('bad selector');
        return sel === '.good' ? { tag: 'good' } : null;
      },
    };
    assert.equal(safeQuery(el, ['<<<invalid>>>', '.good']).tag, 'good');
  });
});

describe('timing helpers', () => {
  test('debounce collapses rapid calls into one', async () => {
    let calls = 0;
    const fn = debounce(() => { calls++; }, 10);
    fn(); fn(); fn();
    assert.equal(calls, 0, 'must not run synchronously');
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(calls, 1);
  });

  test('throttle limits the call rate', async () => {
    let calls = 0;
    const fn = throttle(() => { calls++; }, 20);
    fn(); fn(); fn();
    assert.ok(calls <= 1, `throttle should not exceed one immediate call, got ${calls}`);
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(calls >= 1);
  });
});

describe('generateId', () => {
  test('is prefixed and unique', () => {
    const a = generateId('phish');
    const b = generateId('phish');
    assert.ok(a.startsWith('phish-'));
    assert.notEqual(a, b);
  });
});

describe('isVisible', () => {
  test('treats a missing element as not visible', () => {
    assert.equal(isVisible(null), false);
  });

  test('treats a zero-size element as not visible', () => {
    assert.equal(isVisible({ offsetWidth: 0, offsetHeight: 0 }), false);
  });

  test('treats a sized, unhidden element as visible', () => {
    assert.equal(isVisible({ offsetWidth: 100, offsetHeight: 20 }), true);
  });

  test('treats a display:none element as not visible', () => {
    globalThis.window.getComputedStyle = () => ({ display: 'none', visibility: 'visible', opacity: '1' });
    assert.equal(isVisible({ offsetWidth: 100, offsetHeight: 20 }), false);
    globalThis.window.getComputedStyle = () => ({ display: 'block', visibility: 'visible', opacity: '1' });
  });
});