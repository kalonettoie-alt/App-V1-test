
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Essentiel pour que les assets se chargent correctement en mode HashRouter
  build: {
    outDir: 'dist',
  }
});