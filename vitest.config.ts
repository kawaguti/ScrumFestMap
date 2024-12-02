import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.{test,spec}.{ts,tsx}'],
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@db': resolve(__dirname, './db'),
    },
  }
});