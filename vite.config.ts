import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5199,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200, // three.js dominates the bundle
  },
});
