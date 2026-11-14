/**
 * Regression tests for F-015: persisted settings are untrusted input.
 * Boot a fresh service-worker module for each storage fixture so the real
 * startup path and public message contract are exercised.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import chromeMockModule from './helpers/chrome-mock.js';

const { createChromeMock } = chromeMockModule;
let bootCount = 0;

async function bootWithSettings(sync) {
  const mock = createChromeMock({ sync });
  globalThis.chrome = mock.chrome;
  const worker = new URL('../src/background.js', import.meta.url);
  await import(`${worker.href}?stored-settings-fixture=${++bootCount}`);
  await mock.flush();
  await mock.flush();
  return mock;
}

describe('stored settings validation (F-015)', () => {
  it('keeps valid preferences, including false, zero and an empty whitelist', async () => {
    const mock = await bootWithSettings({
      autoScan: false,
      highlightLinks: false,
      showTooltip: false,
      sensitivityThreshold: 0,
      theme: 'dark',
      whitelist: [],
      ignoredExtraSetting: 'not part of the public settings contract',
    });
    assert.deepEqual(await mock.send({ type: 'GET_SETTINGS' }), {
      autoScan: false,
      sensitivityThreshold: 0,
      highlightLinks: false,
      showTooltip: false,
      theme: 'dark',
      whitelist: [],
    });
  });

  it('uses safe defaults for malformed stored fields and fails closed on a corrupt whitelist', async () => {
    const mock = await bootWithSettings({
      autoScan: 'false',
      highlightLinks: [],
      showTooltip: null,
      sensitivityThreshold: '0.9',
      theme: 'invalid-theme',
      whitelist: { '0': 'trusted.example' },
    });
    const actual = await mock.send({ type: 'GET_SETTINGS' });
    assert.equal(actual.autoScan, true);
    assert.equal(actual.highlightLinks, true);
    assert.equal(actual.showTooltip, true);
    assert.equal(actual.sensitivityThreshold, 0.7);
    assert.equal(actual.theme, 'auto');
    assert.deepEqual(actual.whitelist, []);
    assert.deepEqual((await mock.send({ type: 'GET_STATUS' })).settings, actual);
  });

  it('rejects out-of-range and non-finite thresholds on startup', async () => {
    for (const threshold of [-1, 1.01, Infinity, NaN, null, {}, []]) {
      const mock = await bootWithSettings({ sensitivityThreshold: threshold });
      const actual = await mock.send({ type: 'GET_SETTINGS' });
      assert.equal(actual.sensitivityThreshold, 0.7, `rejected ${String(threshold)}`);
    }
  });

  it('filters malformed whitelist entries and canonicalizes valid domains and email addresses', async () => {
    const mock = await bootWithSettings({
      whitelist: [
        '  Example.COM  ', 'EXAMPLE.COM', 'admin@Example.COM',
        '*', '', '   ', 42, null, {}, 'https://example.com',
        '.com', 'bad..com', 'user@', 'a'.repeat(255),
      ],
    });
    const actual = await mock.send({ type: 'GET_SETTINGS' });
    assert.deepEqual(actual.whitelist, ['example.com', 'admin@example.com']);
    assert.deepEqual((await mock.send({ type: 'CONTENT_READY' })).settings, actual);
  });

  it('limits the number of stored whitelist entries used by the worker', async () => {
    const entries = Array.from({ length: 150 }, (_, i) => `domain${i}.example`);
    const mock = await bootWithSettings({ whitelist: entries });
    const actual = await mock.send({ type: 'GET_SETTINGS' });
    assert.equal(actual.whitelist.length, 100);
    assert.equal(actual.whitelist[0], 'domain0.example');
  });
});
