import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    checker({ typescript: true, overlay: false }),
    runtimeErrorOverlay(),
  ],
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
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0",
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
        static: './static.html'
      },
    },
  },
});
