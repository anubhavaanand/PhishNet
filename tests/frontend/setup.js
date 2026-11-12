import '@testing-library/jest-dom/vitest';

/**
 * Shared setup for the frontend suites.
 *
 * The React modules read `chrome` at import time (frontend/src/lib/messaging.js
 * captures it into a module-level `api` binding), so a stub has to exist before
 * any module is imported. Individual suites install their own via
 * tests/frontend/helpers/chrome.js and re-import the module under test.
 */

// jsdom does not implement matchMedia, which some components read.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}