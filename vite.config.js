import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * PhishNet Vite configuration
 *
 * Builds the React popup and options page into the existing extension
 * directory. The output goes to dist/ and the manifest points there.
 *
 * Key constraints:
 *  - No external CDNs (CSP: script-src 'self')
 *  - No eval / new Function (CSP compliant)
 *  - Fonts and icons are bundled locally
 */
export default defineConfig(({ mode }) => {
  const isOptions = mode === 'options';

  return {
    plugins: [react()],

    // Multi-page build: popup + options share the same config
    build: {
      outDir: 'dist',
      emptyOutDir: false, // keep both pages between sequential builds
      rollupOptions: {
        input: isOptions
          ? { options: resolve(__dirname, 'frontend/options.html') }
          : { popup: resolve(__dirname, 'frontend/popup.html') },
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
        '@': resolve(__dirname, 'frontend/src'),
      },
    },

    // Suppress React dev warnings in production
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  };
});
