import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installChrome } from './helpers/chrome.js';

/**
 * The messaging layer is the only bridge between the React UI and the service
 * worker. These tests pin the message contract: every type below has a matching
 * case in src/background.js, and the response shapes are what the hooks and
 * components read.
 */

const mock = installChrome();
const load = () => import('@/lib/messaging');

describe('sendMessage', () => {
  beforeEach(() => mock.reset());

  it('resolves with the worker response', async () => {
    const { sendMessage } = await load();
    mock.respondWith({ ok: 1 });
    await expect(sendMessage({ type: 'PING' })).resolves.toEqual({ ok: 1 });
  });

  it('sends the message unchanged', async () => {
    const { sendMessage } = await load();
    mock.respondWith(null);
    await sendMessage({ type: 'GET_SETTINGS' });
    expect(mock.sent[0]).toEqual({ type: 'GET_SETTINGS' });
  });

  it('propagates a rejected send', async () => {
    const { sendMessage } = await load();
    mock.failWith('Receiving end does not exist');
    await expect(sendMessage({ type: 'GET_SETTINGS' })).rejects.toThrow(/Receiving end/);
  });

  it('resolves with undefined when the worker has nothing to say', async () => {
    const { sendMessage } = await load();
    mock.respondWith(undefined);
    await expect(sendMessage({ type: 'PING' })).resolves.toBeUndefined();
  });
});

describe('settings and whitelist requests', () => {
  beforeEach(() => mock.reset());

  it('getSettings asks for GET_SETTINGS and returns the payload', async () => {
    const { getSettings } = await load();
    mock.respondWith({ theme: 'dark' });
    await expect(getSettings()).resolves.toEqual({ theme: 'dark' });
    expect(mock.sent[0].type).toBe('GET_SETTINGS');
  });

  it('getSettings swallows a worker error and returns null', async () => {
    const { getSettings } = await load();
    mock.failWith('no worker');
    await expect(getSettings()).resolves.toBeNull();
  });

  it('updateSettings sends the whole settings object', async () => {
    const { updateSettings } = await load();
    mock.respondWith({ success: true });
    await updateSettings({ autoScan: false, theme: 'dark' });
    expect(mock.sent[0]).toEqual({
      type: 'UPDATE_SETTINGS',
      settings: { autoScan: false, theme: 'dark' },
    });
  });

  it('addWhitelistEntry sends the entry', async () => {
    const { addWhitelistEntry } = await load();
    mock.respondWith({ success: true, whitelist: ['a.com'] });
    await addWhitelistEntry('a.com');
    expect(mock.sent[0]).toEqual({ type: 'ADD_WHITELIST', entry: 'a.com' });
  });

  it('removeWhitelistEntry sends the entry', async () => {
    const { removeWhitelistEntry } = await load();
    mock.respondWith({ success: true, whitelist: [] });
    await removeWhitelistEntry('a.com');
    expect(mock.sent[0]).toEqual({ type: 'REMOVE_WHITELIST', entry: 'a.com' });
  });
});

describe('request helpers', () => {
  beforeEach(() => mock.reset());

  it('getStatus returns the status payload', async () => {
    const { getStatus } = await load();
    mock.respondWith({ modelStatus: 'ready', progress: 1, settings: { theme: 'dark' } });
    await expect(getStatus()).resolves.toMatchObject({ modelStatus: 'ready', progress: 1 });
  });

  it('scanCurrentTab returns the scan payload', async () => {
    const { scanCurrentTab } = await load();
    mock.respondWith({ success: true, result: { label: 'legitimate_email' } });
    await expect(scanCurrentTab()).resolves.toMatchObject({ success: true });
    expect(mock.sent[0]).toEqual({ type: 'SCAN_CURRENT_TAB' });
  });

  it('scanCurrentTab turns a worker error into a result object', async () => {
    const { scanCurrentTab } = await load();
    mock.failWith('no email open');
    await expect(scanCurrentTab()).resolves.toEqual({ success: false, error: 'no email open' });
  });

  it('clearHistory sends CLEAR_HISTORY', async () => {
    const { clearHistory } = await load();
    mock.respondWith({ success: true });
    await clearHistory();
    expect(mock.sent[0]).toEqual({ type: 'CLEAR_HISTORY' });
  });
});

describe('getLocalStorage', () => {
  beforeEach(() => mock.reset());

  it('reads the requested keys through storage.local', async () => {
    const { getLocalStorage } = await load();
    mock.setLocal('scanHistory', [{ id: 1 }]);
    const res = await getLocalStorage(['scanHistory']);
    expect(res).toEqual({ scanHistory: [{ id: 1 }] });
    expect(mock.sent).toHaveLength(0);
  });

  it('resolves an empty object when storage is unavailable', async () => {
    const { getLocalStorage } = await load();
    const saved = globalThis.chrome.storage.local;
    globalThis.chrome.storage.local = undefined;
    await expect(getLocalStorage(['scanHistory'])).resolves.toEqual({});
    globalThis.chrome.storage.local = saved;
  });
});

describe('event subscriptions', () => {
  beforeEach(() => mock.reset());

  it('onModelStatus delivers msg.payload and then unsubscribes', async () => {
    const { onModelStatus } = await load();
    const seen = [];
    const off = onModelStatus((p) => seen.push(p));

    mock.deliver({ type: 'MODEL_STATUS', payload: { status: 'ready', progress: 1 } });
    expect(seen).toEqual([{ status: 'ready', progress: 1 }]);

    off();
    mock.deliver({ type: 'MODEL_STATUS', payload: { status: 'loading', progress: 0 } });
    expect(seen).toHaveLength(1);
  });

  it('onModelStatus ignores other message types', async () => {
    const { onModelStatus } = await load();
    const seen = [];
    onModelStatus((p) => seen.push(p));

    mock.deliver({ type: 'SETTINGS_UPDATE', payload: { theme: 'dark' } });
    expect(seen).toHaveLength(0);
  });

  it('onSettingsUpdate delivers msg.payload', async () => {
    const { onSettingsUpdate } = await load();
    const seen = [];
    onSettingsUpdate((p) => seen.push(p));

    mock.deliver({ type: 'SETTINGS_UPDATE', payload: { theme: 'dark' } });
    expect(seen).toEqual([{ theme: 'dark' }]);
  });
});

describe('no extension runtime', () => {
  it('rejects with a clear error when chrome is absent', async () => {
    const saved = globalThis.chrome;
    delete globalThis.chrome;
    vi.resetModules();
    const { sendMessage } = await import('@/lib/messaging');
    await expect(sendMessage({ type: 'GET_SETTINGS' })).rejects.toThrow(/Extension runtime unavailable/);
    globalThis.chrome = saved;
    vi.resetModules();
  });
});