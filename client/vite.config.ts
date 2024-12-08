import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      babel: {
        plugins: [
          ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
        ]
      }
    }),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
  ],
  css: {
    postcss: path.resolve(__dirname, 'postcss.config.cjs'),
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@db": path.resolve(__dirname, "../db"),
      "@/components": path.resolve(__dirname, "src/components"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5000'
    },
    origin: 'http://localhost:3000'
  },
  base: '/',
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
  },
});
