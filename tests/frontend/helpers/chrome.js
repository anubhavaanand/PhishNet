/**
 * chrome.* stub for the frontend suites.
 *
 * frontend/src/lib/messaging.js captures `chrome` into a module-level binding at
 * import time, so this has to be installed on globalThis before the module is
 * imported. Suites do:
 *
 *   const mock = installChrome();
 *   const messaging = await import('@/lib/messaging');
 *
 * messaging.js uses the promise form of chrome.runtime.sendMessage (MV3), so
 * the stub returns promises rather than taking a callback.
 */

/**
 * @param {object} [options]
 * @param {object} [options.storage] initial chrome.storage.local contents
 * @returns {object} handle
 */
export function installChrome(options = {}) {
  const local = { ...(options.storage || {}) };
  const sent = [];
  const listeners = [];

  let responder = null; // (message) => value | Error

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  const chrome = {
    runtime: {
      get lastError() {
        return null;
      },
      sendMessage(message) {
        sent.push(clone(message));
        // The worker owns storage; simulate the side effects the UI depends on.
        if (message && message.type === 'CLEAR_HISTORY') {
          local.scanHistory = [];
          local.scanStats = { total: 0, phishing: 0, safe: 0, uncertain: 0, trusted: 0 };
        }
        if (!responder) return Promise.resolve(undefined);
        const out = responder(message);
        if (out instanceof Error) return Promise.reject(out);
        return Promise.resolve(out);
      },
      onMessage: {
        addListener(fn) {
          listeners.push(fn);
        },
        removeListener(fn) {
          const i = listeners.indexOf(fn);
          if (i >= 0) listeners.splice(i, 1);
        },
      },
    },

    storage: {
      local: {
        get(keys, callback) {
          let value;
          if (Array.isArray(keys)) {
            value = {};
            for (const k of keys) if (k in local) value[k] = clone(local[k]);
          } else if (typeof keys === 'string') {
            value = { [keys]: clone(local[keys]) };
          } else if (keys && typeof keys === 'object') {
            value = { ...clone(keys) };
            for (const k of Object.keys(keys)) if (k in local) value[k] = clone(local[k]);
          } else {
            value = clone(local);
          }
          if (callback) return callback(value);
          return Promise.resolve(value);
        },
        set(obj, callback) {
          const copy = clone(obj);
          Object.assign(local, copy);
          if (callback) return callback();
          return Promise.resolve();
        },
      },
    },
  };

  globalThis.chrome = chrome;

  return {
    chrome,
    sent,
    listeners,
    local,
    /** Make every subsequent sendMessage resolve with this value. */
    respondWith(value) {
      responder = typeof value === 'function' ? value : () => value;
    },
    /** Make every subsequent sendMessage reject with this message. */
    failWith(message) {
      responder = () => new Error(message);
    },
    setLocal(key, value) {
      local[key] = value;
    },
    /** Deliver a message as if the service worker broadcast it. */
    deliver(message) {
      for (const fn of [...listeners]) fn(message, {}, () => {});
    },
    reset() {
      sent.length = 0;
      listeners.length = 0;
      responder = null;
      for (const k of Object.keys(local)) delete local[k];
      Object.assign(local, clone(options.storage || {}));
    },
  };
}