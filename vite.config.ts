import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk splitting for better caching and code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React dependencies
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI component libraries
          'ui-vendor': ['@radix-ui/react-accordion', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-slot', '@radix-ui/react-toast'],
          // Data fetching
          'query-vendor': ['@tanstack/react-query'],
          // Backend integration
          'supabase-vendor': ['@supabase/supabase-js'],
          // Form handling
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Charts and visualization
          'chart-vendor': ['recharts'],
          // Icons
          'icon-vendor': ['lucide-react']
        },
        // Separate CSS files for better caching
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    // Compress assets without terser to avoid dependency issues
    assetsInlineLimit: 2048, // Reduced inline limit to force external CSS
    minify: 'esbuild', // Use esbuild instead of terser
    cssCodeSplit: true, // Enable CSS code splitting
    cssMinify: true, // Minify CSS
    chunkSizeWarningLimit: 1000 // Warn for chunks larger than 1MB
  },
  // CSS preprocessing optimization
  css: {
    devSourcemap: false,
    preprocessorOptions: {
      css: {
        charset: false // Remove charset to reduce bundle size
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js']
  }
}));
