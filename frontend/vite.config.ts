import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devRecordingAssets, speechManifests } from './vite.shared';

export default defineConfig({
  plugins: [react(), devRecordingAssets(), speechManifests()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } } },
  build: {
    rollupOptions: {
      output: {
        // Cache the framework separately from frequently edited character writing.
        // Coach definitions stay synchronous, so changing selection cannot race a chunk load.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        },
      },
    },
  },
});
