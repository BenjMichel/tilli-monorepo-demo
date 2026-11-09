import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests render the app through react-native-web, the same renderer as the web build, in happy-dom.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { 'react-native': 'react-native-web' } },
  test: { environment: 'happy-dom' },
});
