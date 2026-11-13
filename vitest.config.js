import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest configuration for the React popup and options UI.
 *
 * Kept separate from vite.config.js on purpose. That config sets
 * `root: 'frontend'` for the extension build, which would make the test runner
 * look for tests under frontend/ and miss tests/ entirely. A standalone config
 * does not inherit it.
 *
 * Only tests under tests/frontend/ run here. The extension-core suites in
 * tests/*.test.js run under node --test instead — see package.json.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend/src'),
    },
  },

  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/frontend/**/*.test.{js,jsx}'],
    setupFiles: ['tests/frontend/setup.js'],
    // The extension ships no CSS imports in the components; tokens.css is
    // loaded by the HTML shell, not by the modules under test.
    css: false,
    restoreMocks: true,
  },
});