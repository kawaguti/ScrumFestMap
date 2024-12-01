import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globals: true,
    deps: {
      optimizer: {
        web: {
          include: ['@testing-library/user-event']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@db': resolve(__dirname, './db'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
});
