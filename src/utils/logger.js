/**
 * PhishNet Logger Utility
 * Production-safe logging - only errors/warnings in production
 */

const IS_DEBUG = false; // Set to true for local development

const logger = {
  debug: (...args) => {
    if (IS_DEBUG) console.log('[PhishNet]', ...args);
  },
  info: (...args) => {
    if (IS_DEBUG) console.info('[PhishNet]', ...args);
  },
  warn: (...args) => {
    console.warn('[PhishNet]', ...args);
  },
  error: (...args) => {
    console.error('[PhishNet]', ...args);
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.PhishNet = globalThis.PhishNet || {};
  globalThis.PhishNet.logger = logger;
}

export default logger;