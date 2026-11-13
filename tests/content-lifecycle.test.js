const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const path = require('node:path');

test('content script unregisters its runtime listener when a mail tab unloads', () => {
  const callbacks = {};
  const listeners = new Set();
  let addCalls = 0;
  let observerDisconnected = false;

  class MutationObserverMock {
    observe() {}
    disconnect() { observerDisconnected = true; }
  }

  const context = {
    globalThis: {
      PhishNet: {
        getSelectorsForCurrentSite: () => ({ provider: 'gmail', variant: 'default', selectors: { messages: '[data-message-id]' } })
      }
    },
    window: {
      addEventListener: (event, handler) => { callbacks[event] = handler; }
    },
    document: {
      readyState: 'loading',
      body: {},
      addEventListener: (event, handler) => { callbacks[event] = handler; },
      querySelectorAll: () => []
    },
    location: { href: 'https://mail.google.com/mail/u/0/' },
    MutationObserver: MutationObserverMock,
    chrome: { runtime: {
      onMessage: {
        addListener: (fn) => { addCalls++; listeners.add(fn); },
        removeListener: (fn) => listeners.delete(fn)
      },
      sendMessage: () => Promise.resolve()
    } },
    setTimeout,
    clearTimeout,
    console
  };

  const source = readFileSync(path.resolve(__dirname, '../src/content.js'), 'utf8');
  runInNewContext(source, context);
  assert.equal(listeners.size, 0, 'listener should not register before DOMContentLoaded');

  callbacks.DOMContentLoaded();
  assert.equal(listeners.size, 1);
  callbacks.DOMContentLoaded();
  assert.equal(addCalls, 1, 'reinitialization must not register duplicate listeners');
  observerDisconnected = false;
  callbacks.beforeunload();
  assert.equal(listeners.size, 0);
  assert.equal(observerDisconnected, true);
});
