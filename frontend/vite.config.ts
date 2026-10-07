import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  // Pre-bundle up front so lazy pages never trigger a mid-session re-optimise (which can load two React copies).
  optimizeDeps: { include: ['react', 'react-dom', 'react-router', 'leaflet', 'react-leaflet', 'qrcode', 'axios', 'three', 'lenis'] },
  build: {
    rollupOptions: {
      output: { manualChunks: { leaflet: ['leaflet', 'react-leaflet'], three: ['three'], react: ['react', 'react-dom', 'react-router'] } },
    },
  },
});
