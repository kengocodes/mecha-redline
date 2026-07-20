import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5199,
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2400, // phaser + three dominate the bundle
  },
});
