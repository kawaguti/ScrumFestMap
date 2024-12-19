import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Determine if we're running on Replit
const isReplit = !!process.env.REPL_SLUG && !!process.env.REPL_OWNER;
const replitUrl = isReplit ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : undefined;

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
    port: 3000,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      clientPort: isReplit ? 443 : 3000,
      host: isReplit ? replitUrl : 'localhost',
      protocol: isReplit ? 'wss' : 'ws'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    minify: 'terser',
    sourcemap: !isReplit,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'wouter'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          utils: ['@tanstack/react-query', 'zod', '@hookform/resolvers']
        }
      }
    }
  },
});
