import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Determine if we're running on Replit and in production
const isReplit = !!process.env.REPL_SLUG && !!process.env.REPL_OWNER;
const replitUrl = isReplit ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : undefined;
const isProduction = isReplit || process.env.NODE_ENV === 'production';

// Configure plugins
const plugins = [
  react(),
  checker({ typescript: true, overlay: false }),
  runtimeErrorOverlay(),
];

export default defineConfig({
  plugins,
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
    port: isProduction ? 3000 : 3001,
    strictPort: true,
    host: true,
    hmr: isProduction ? false : {
      clientPort: 3001,
      host: 'localhost',
    },
    proxy: {
      '^/api/.*': {
        target: isReplit 
          ? isProduction
            ? `https://${replitUrl}`
            : 'http://0.0.0.0:5000'
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: isReplit && isProduction,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err) => {
            console.warn('Proxy error:', err);
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
    sourcemap: false,
    cssCodeSplit: true,
    assetsDir: 'assets',
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'wouter'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          utils: ['@tanstack/react-query', 'zod', '@hookform/resolvers']
        },
        assetFileNames: 'assets/[name].[hash][extname]',
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  css: {
    devSourcemap: !isProduction,
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[hash:base64:5]'
    }
  }
});