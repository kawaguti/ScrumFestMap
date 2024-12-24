import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import themePlugin from "@replit/vite-plugin-shadcn-theme-json"

export default defineConfig({
  plugins: [react(), themePlugin()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    hmr: {
      clientPort: 443
    }
  },
  css: {
    postcss: './postcss.config.js',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@db': path.resolve(__dirname, '../db')
    }
  }
})