import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API has no CORS: in development, the site reaches it through /api on its own origin.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: API_URL, rewrite: (path) => path.replace(/^\/api/, '') } },
  },
  test: { environment: 'happy-dom' },
});
