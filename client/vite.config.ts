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
  optimizeDeps: {
    exclude: ['@tanstack/react-query'],
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'wouter',
      '@hookform/resolvers',
      'zod'
    ]
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
    port: 3001,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      port: 3001,
      host: "0.0.0.0",
    },
    proxy: {
      '/api': {
        target: 'http://0.0.0.0:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
        }
      }
    }
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    minify: 'terser',
    sourcemap: true,
    cssCodeSplit: true,
    assetsDir: 'assets',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'wouter'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          utils: ['@tanstack/react-query', 'zod', '@hookform/resolvers']
        }
      }
    }
  }
});