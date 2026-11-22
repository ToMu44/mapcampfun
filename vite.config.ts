import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages liefert die App unter https://<user>.github.io/mapcampfun/ aus.
export default defineConfig({
  base: '/mapcampfun/',
  plugins: [react()],
  worker: { format: 'es' },
  build: { chunkSizeWarningLimit: 1600 },
});
