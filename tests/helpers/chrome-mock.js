/**
 * Minimal chrome.* API mock for exercising the extension service worker.
 *
 * Only implements the surface src/background.js actually touches. Every call is
 * recorded so tests can assert on what the worker broadcast or persisted.
 */

/**
 * @param {object} [options]
 * @param {object} [options.sync]        Pre-seeded chrome.storage.sync contents
 * @param {object} [options.local]       Pre-seeded chrome.storage.local contents
 * @param {Function} [options.onInference] (message) => result, overrides the fake model output
 * @returns {object} mock handle
 */
function createChromeMock(options = {}) {
  const syncStore = { ...(options.sync || {}) };
  const localStore = { ...(options.local || {}) };

  /** @type {Function[]} */
  const messageListeners = [];
  const sentMessages = [];
  const tabMessages = [];
  const offscreenState = { exists: false, created: 0, closed: 0, createError: null };

  const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

  const pick = (store, keys) => {
    if (keys === null || keys === undefined) return clone(store);
    if (typeof keys === 'string') return { [keys]: clone(store[keys]) };
    if (Array.isArray(keys)) {
      const out = {};
      for (const k of keys) if (k in store) out[k] = clone(store[k]);
      return out;
    }
    if (typeof keys === 'object') {
      const out = { ...keys };
      for (const k of Object.keys(keys)) if (k in store) out[k] = clone(store[k]);
      return out;
    }
    return {};
  };

  const chrome = {
    runtime: {
      id: 'phishnet-test',
      getURL: (p) => `chrome-extension://phishnet-test/${String(p).replace(/^\//, '')}`,
      onMessage: {
        addListener: (fn) => messageListeners.push(fn),
        removeListener: (fn) => {
          const i = messageListeners.indexOf(fn);
          if (i >= 0) messageListeners.splice(i, 1);
        },
        hasListener: (fn) => messageListeners.includes(fn),
      },
      onInstalled: { addListener() {}, removeListener() {} },
      onStartup: { addListener() {}, removeListener() {} },
      sendMessage: (message) => {
        sentMessages.push(clone(message));

        // Simulate the offscreen document answering an inference request.
        if (message && message.type === 'RUN_INFERENCE') {
          Promise.resolve().then(() => {
            const result = options.onInference
              ? options.onInference(message)
              : { label: 'legitimate_email', confidence: 0.93, reasons: ['Content appears legitimate'] };
            deliver({ type: 'INFERENCE_RESULT', requestId: message.requestId, result });
          });
        }
        return Promise.resolve();
      },
    },

    storage: {
      sync: {
        get: (keys, cb) => {
          const value = pick(syncStore, keys);
          if (typeof cb === 'function') return cb(value);
          return Promise.resolve(value);
        },
        set: (obj, cb) => {
          Object.assign(syncStore, clone(obj));
          if (typeof cb === 'function') return cb();
          return Promise.resolve();
        },
      },
      local: {
        get: (keys, cb) => {
          const value = pick(localStore, keys);
          if (typeof cb === 'function') return cb(value);
          return Promise.resolve(value);
        },
        set: (obj, cb) => {
          Object.assign(localStore, clone(obj));
          if (typeof cb === 'function') return cb();
          return Promise.resolve();
        },
      },
    },

    tabs: {
      query: (_query, cb) => {
        const tabs = [];
        if (typeof cb === 'function') return cb(tabs);
        return Promise.resolve(tabs);
      },
      sendMessage: (tabId, message) => {
        tabMessages.push({ tabId, message: clone(message) });
        return Promise.resolve();
      },
    },

    offscreen: {
      hasDocument: async () => offscreenState.exists,
      createDocument: async () => {
        if (options.offscreenCreateError) throw new Error(options.offscreenCreateError);
        offscreenState.exists = true;
        offscreenState.created++;
      },
      closeDocument: async () => {
        offscreenState.exists = false;
        offscreenState.closed++;
      },
    },
  };

  /** Deliver a message to the worker as if another extension context sent it. */
  function deliver(message) {
    const results = [];
    for (const fn of [...messageListeners]) {
      results.push(fn(message, { id: 'sender' }, () => {}));
    }
    return results;
  }

  /**
   * Send a message and resolve with the worker's response.
   * Mirrors chrome.runtime.onMessage's async sendResponse contract.
   */
  function send(message) {
    return new Promise((resolve) => {
      let settled = false;
      const sendResponse = (value) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };

      let keepOpen = false;
      for (const fn of [...messageListeners]) {
        const ret = fn(message, { id: 'test' }, sendResponse);
        if (ret === true) keepOpen = true;
      }

      // Listener returned a promise (or nothing) without calling sendResponse.
      if (!settled && !keepOpen) {
        setImmediate(() => {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        });
      }
    });
  }

  /** Wait until the worker's async init() has settled. */
  const flush = () => new Promise((r) => setTimeout(r, 0));

  return {
    chrome,
    deliver,
    send,
    flush,
    messageListeners,
    sentMessages,
    tabMessages,
    offscreenState,
    syncStore,
    localStore,
    reset() {
      messageListeners.length = 0;
      sentMessages.length = 0;
      tabMessages.length = 0;
      offscreenState.exists = false;
      offscreenState.created = 0;
      offscreenState.closed = 0;
      for (const k of Object.keys(syncStore)) delete syncStore[k];
      for (const k of Object.keys(localStore)) delete localStore[k];
    },
  };
}

module.exports = { createChromeMock };