/**
 * Service-worker message router tests.
 *
 * src/background.js is an ES module that registers its listener for
 * side effects, so this suite installs the chrome mock on globalThis, imports
 * the worker once, and then drives it through the same onMessage contract the
 * popup and content scripts use.
 */
import { test, describe, before, it } from 'node:test';
import assert from 'node:assert/strict';

import chromeMockModule from './helpers/chrome-mock.js';

const { createChromeMock } = chromeMockModule;

const mock = createChromeMock();
globalThis.chrome = mock.chrome;

// Importing registers the runtime.onMessage listener and kicks off init().
await import('../src/background.js');
await mock.flush();
await mock.flush();

const send = (message) => mock.send(message);

describe('service worker bootstrap', () => {
  it('registers a message listener', () => {
    assert.ok(mock.messageListeners.length > 0, 'worker must register onMessage');
  });

  it('creates the offscreen document once', async () => {
    const res = await send({ type: 'GET_STATUS' });
    assert.equal(mock.offscreenState.created, 1);
    assert.ok(res);
  });
});

describe('GET_STATUS / GET_SETTINGS', () => {
  it('reports a status payload with settings', async () => {
    const res = await send({ type: 'GET_STATUS' });
    assert.ok(res);
    assert.ok('modelStatus' in res, 'status payload must include modelStatus');
    assert.ok('progress' in res);
    assert.ok(res.settings, 'status payload must include settings');
  });

  it('returns the documented default settings', async () => {
    const res = await send({ type: 'GET_SETTINGS' });
    assert.equal(res.autoScan, true);
    assert.equal(res.highlightLinks, true);
    assert.equal(res.showTooltip, true);
    assert.equal(res.sensitivityThreshold, 0.7);
    assert.equal(res.theme, 'auto');
    assert.ok(Array.isArray(res.whitelist));
    assert.ok(res.whitelist.includes('github.com'));
  });
});

describe('UPDATE_SETTINGS', () => {
  it('persists the change to storage.sync', async () => {
    const res = await send({ type: 'UPDATE_SETTINGS', settings: { autoScan: false, theme: 'dark' } });
    assert.equal(res.success, true);
    assert.equal(res.settings.autoScan, false);
    assert.equal(res.settings.theme, 'dark');
    assert.equal(mock.syncStore.autoScan, false, 'must be written through to storage');
    assert.equal(mock.syncStore.theme, 'dark');
  });

  it('is reflected by a subsequent GET_SETTINGS', async () => {
    const res = await send({ type: 'GET_SETTINGS' });
    assert.equal(res.autoScan, false);
    assert.equal(res.theme, 'dark');
  });

  it('preserves unrelated keys', async () => {
    await send({ type: 'UPDATE_SETTINGS', settings: { showTooltip: false } });
    const res = await send({ type: 'GET_SETTINGS' });
    assert.equal(res.showTooltip, false);
    assert.equal(res.autoScan, false, 'autoScan must survive an unrelated update');
  });
});

describe('whitelist management', () => {
  it('adds a trimmed, lowercased entry exactly once', async () => {
    const first = await send({ type: 'ADD_WHITELIST', entry: '  Example.COM  ' });
    assert.equal(first.success, true);
    assert.ok(first.whitelist.includes('example.com'));

    const second = await send({ type: 'ADD_WHITELIST', entry: 'example.com' });
    assert.equal(second.whitelist.filter((w) => w === 'example.com').length, 1, 'no duplicates');
  });

  it('ignores an empty entry', async () => {
    const before = (await send({ type: 'GET_SETTINGS' })).whitelist.length;
    const res = await send({ type: 'ADD_WHITELIST', entry: '   ' });
    assert.equal(res.success, true);
    const after = (await send({ type: 'GET_SETTINGS' })).whitelist.length;
    assert.equal(after, before, 'blank entries must not be stored');
  });

  it('removes an entry', async () => {
    const res = await send({ type: 'REMOVE_WHITELIST', entry: 'example.com' });
    assert.equal(res.success, true);
    assert.equal(res.whitelist.includes('example.com'), false);
  });

  it('persists the whitelist to storage', async () => {
    assert.ok(Array.isArray(mock.syncStore.whitelist));
    assert.equal(mock.syncStore.whitelist.includes('example.com'), false);
  });
});

describe('CLEAR_HISTORY', () => {
  it('resets history and stats in local storage', async () => {
    mock.localStore.scanHistory = [{ id: 1 }];
    mock.localStore.scanStats = { total: 5 };

    const res = await send({ type: 'CLEAR_HISTORY' });
    assert.equal(res.success, true);
    assert.deepEqual(mock.localStore.scanHistory, []);
    assert.equal(mock.localStore.scanStats.total, 0);
  });
});

describe('SCAN_EMAIL gating', () => {
  it('reports useHeuristic while the model is not ready', async () => {
    // The worker boots in the 'loading' state until the offscreen document
    // reports OFFSCREEN_READY.
    const res = await send({
      type: 'SCAN_EMAIL',
      payload: { text: 'hello', subject: 'hi' },
    });
    assert.equal(res.success, false);
    assert.equal(res.useHeuristic, true);
  });

  it('returns the inference result once the model reports ready', async () => {
    mock.deliver({ type: 'OFFSCREEN_READY' });
    await mock.flush();

    const res = await send({
      type: 'SCAN_EMAIL',
      payload: { text: 'hello', subject: 'hi' },
    });
    assert.equal(res.success, true, JSON.stringify(res));
    assert.ok(res.result, 'expected an inference result');
    assert.equal(typeof res.result.label, 'string');
  });
});

describe('unknown messages', () => {
  it('returns a structured error rather than throwing', async () => {
    const res = await send({ type: 'TOTALLY_UNKNOWN' });
    assert.equal(res.success, false);
    assert.match(res.error, /Unknown message type/);
  });

  it('ignores messages without a type', async () => {
    const res = await send({ noType: true });
    assert.equal(res, undefined);
  });
});

describe('SCAN_CURRENT_TAB', () => {
  it('reports a clear error when there is no active tab', async () => {
    const res = await send({ type: 'SCAN_CURRENT_TAB' });
    assert.equal(res.success, false);
    assert.match(res.error, /No active tab/i);
  });
});