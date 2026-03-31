import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    hmr: { clientPort: 5173 },
    proxy: {
      '/api': {
        // Mode B (local dev) : backend sur localhost:4000
        // Mode A (Docker)    : VITE_API_PROXY=http://backend:4000 dans docker-compose
        // ⚠️  En Docker le backend est exposé sur 4001 côté hôte
        target: process.env.VITE_API_PROXY || 'http://localhost:4001',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
