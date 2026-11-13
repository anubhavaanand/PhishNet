import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * PhishNet Vite configuration
 *
 * Builds the React popup and options page into dist/, which is what
 * manifest.json points at (dist/popup.html, dist/options.html).
 *
 * Three details matter for a Chrome extension build:
 *
 *  - `root` is frontend/, so the HTML emits at the dist root rather than
 *    dist/frontend/. The manifest can then reference a stable path.
 *  - `base: './'` keeps every asset URL relative. An absolute /assets/... URL
 *    resolves against the extension origin, not dist/, and the script 404s —
 *    which shows up as a blank popup rather than a build error.
 *  - Both pages build in a single pass, so `npm run build` is the whole build
 *    and neither page can be left stale from an earlier run.
 *
 * Key constraints:
 *  - No external CDNs (CSP: script-src 'self')
 *  - No eval / new Function (CSP compliant)
 *  - Fonts and icons are bundled locally
 */

const root = resolve(__dirname, 'frontend');

export default defineConfig({
  root,

  // Extension pages load from chrome-extension://<id>/dist/popup.html, so
  // absolute /assets/... would resolve outside dist/. Keep every URL relative.
  base: './',

  // The extension loads these from the package root; do not serve public/.
  publicDir: false,

  plugins: [react()],

  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(root, 'popup.html'),
        options: resolve(root, 'options.html'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
    // Keep chunks small for fast popup load
    chunkSizeWarningLimit: 200,
    minify: 'esbuild',
    sourcemap: false,
  },

  resolve: {
    alias: {
      '@': resolve(root, 'src'),
    },
  },

  // Suppress React dev warnings in production
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});