import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import checker from "vite-plugin-checker";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// Determine if we're running on Replit
const isReplit = !!process.env.REPL_SLUG && !!process.env.REPL_OWNER;
const replitUrl = isReplit ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : undefined;

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
    port: process.env.NODE_ENV === 'production' ? 3000 : 3001,
    strictPort: true,
    host: true,
    hmr: {
      clientPort: isReplit && process.env.NODE_ENV === 'production' ? 443 : 3001,
      host: isReplit ? replitUrl : 'localhost',
      protocol: isReplit && process.env.NODE_ENV === 'production' ? 'wss' : 'ws',
      path: '/_hmr'
    },
    proxy: {
      '/api': {
        target: isReplit 
          ? process.env.NODE_ENV === 'production'
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : 'http://0.0.0.0:5000'
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: isReplit && process.env.NODE_ENV === 'production',
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Proxy Request:', req.method, req.url);
            if (!req.url?.startsWith('/api')) {
              console.log('Non-API request detected:', req.url);
            }
            console.log('Target URL:', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Proxy Response:', proxyRes.statusCode, req.url);
            if (proxyRes.statusCode >= 400) {
              console.log('Error Response Headers:', proxyRes.headers);
              console.log('Response Type:', proxyRes.headers['content-type']);
            }
          });
        }
      },
      '/api/my-events': {
        target: isReplit 
          ? process.env.NODE_ENV === 'production'
            ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
            : 'http://0.0.0.0:5000'
          : 'http://localhost:5000',
        changeOrigin: true,
        secure: isReplit && process.env.NODE_ENV === 'production',
        ws: true
      }
    }
  },
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    minify: 'terser',
    sourcemap: !isReplit,
    cssCodeSplit: true,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'wouter'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-toast'],
          utils: ['@tanstack/react-query', 'zod', '@hookform/resolvers']
        },
        assetFileNames: (assetInfo) => {
          return `assets/[name].[hash][extname]`;
        },
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js'
      }
    }
  },
  css: {
    devSourcemap: true,
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: isReplit ? '[hash:base64:5]' : '[local]_[hash:base64:5]'
    }
  }
});
