import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
