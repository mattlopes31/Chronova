import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        // En Docker, utiliser le nom du service (api)
        // En local, utiliser localhost
        target: process.env.DOCKER === 'true' ? 'http://api:4000' : 'http://localhost:4000',
        changeOrigin: true,
        // Ne pas échouer si l'API n'est pas disponible
        timeout: 10000,
      },
    },
  },
});
