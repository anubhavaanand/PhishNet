/**
 * Provider detection and selector resolution tests.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { getSelectorsForCurrentSite, EMAIL_SELECTORS, UTILITY_SELECTORS } = require('../src/selectors.js');

const at = (hostname, path = '/') => ({ hostname, href: `https://${hostname}${path}` });

describe('provider detection', () => {
  test('detects Gmail', () => {
    const s = getSelectorsForCurrentSite(at('mail.google.com'));
    assert.equal(s.provider, 'gmail');
    assert.equal(s.selectors, EMAIL_SELECTORS.gmail);
  });

  test('detects Outlook.com', () => {
    for (const host of ['outlook.live.com', 'outlook.com']) {
      const s = getSelectorsForCurrentSite(at(host));
      assert.equal(s.provider, 'outlook');
      assert.equal(s.variant, 'com');
      assert.equal(s.selectors, EMAIL_SELECTORS.outlookCom);
    }
  });

  test('detects Outlook Office 365', () => {
    for (const host of ['outlook.office.com', 'outlook.office365.com']) {
      const s = getSelectorsForCurrentSite(at(host));
      assert.equal(s.provider, 'outlook');
      assert.equal(s.variant, 'office365');
      assert.equal(s.selectors, EMAIL_SELECTORS.outlookOffice365);
    }
  });

  test('detects the /owa/ path form', () => {
    const s = getSelectorsForCurrentSite(at('outlook.office.com', '/owa/#/path'));
    assert.equal(s.variant, 'office365');
  });

  test('returns null on unsupported hosts', () => {
    assert.equal(getSelectorsForCurrentSite(at('example.com')), null);
    assert.equal(getSelectorsForCurrentSite(at('github.com')), null);
  });

  test('returns null when location is missing', () => {
    assert.equal(getSelectorsForCurrentSite(null), null);
  });

  test('tolerates an empty location object', () => {
    assert.equal(getSelectorsForCurrentSite({}), null);
  });
});

describe('selector integrity', () => {
  // Keys every provider must define, because content.js reads them
  // unconditionally when extracting an email.
  const CORE_KEYS = ['messages', 'messageBody', 'subject', 'sender', 'links'];

  test('every provider exposes the core extraction selectors', () => {
    for (const [name, sel] of Object.entries(EMAIL_SELECTORS)) {
      for (const key of CORE_KEYS) {
        assert.ok(key in sel, `${name} is missing "${key}"`);
      }
    }
  });

  test('every provider defines a messageBody fallback chain', () => {
    for (const [name, sel] of Object.entries(EMAIL_SELECTORS)) {
      assert.ok(sel.messageBodyFallback, `${name} has no messageBodyFallback`);
    }
  });

  test('senderEmail is present wherever content.js reads it as an email attribute', () => {
    // Outlook exposes a dedicated sender-email node; Gmail instead carries the
    // address in an [email] attribute on the sender element it already defines.
    for (const name of ['outlook', 'outlookCom', 'outlookOffice365']) {
      assert.ok(EMAIL_SELECTORS[name].senderEmail, `${name} must define senderEmail`);
    }
    assert.equal(EMAIL_SELECTORS.gmail.senderEmail, undefined);
    assert.ok(EMAIL_SELECTORS.gmail.senderFallback, 'gmail must define senderFallback');
  });

  test('selector values are non-empty strings or arrays of strings', () => {
    for (const [name, sel] of Object.entries(EMAIL_SELECTORS)) {
      for (const [key, value] of Object.entries(sel)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          assert.equal(typeof v, 'string', `${name}.${key} must be a string`);
          assert.ok(v.length > 0, `${name}.${key} must not be empty`);
        }
      }
    }
  });

  test('utility selectors define skipElements', () => {
    assert.ok(Array.isArray(UTILITY_SELECTORS.skipElements));
  });
});