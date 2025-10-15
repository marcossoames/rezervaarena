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
  // Asset handling for modern image formats
  assetsInclude: ['**/*.webp', '**/*.avif'],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk splitting and caching for better performance
    rollupOptions: {
      output: {
        // Ensure consistent hashing for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          
          // Different naming strategies for different asset types
          if (/\.(png|jpe?g|webp|avif|svg|ico)$/i.test(assetInfo.name || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(css)$/i.test(assetInfo.name || '')) {
            return `assets/styles/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
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
        }
      }
    },
    // Optimize assets for caching
    assetsInlineLimit: 2048, // Keep small assets inline for fewer requests
    minify: 'esbuild',
    cssCodeSplit: true,
    cssMinify: true,
    chunkSizeWarningLimit: 1000,
    // Ensure source maps are generated for debugging but not in production bundle
    sourcemap: false
  },
  // CSS optimization
  css: {
    devSourcemap: false
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js']
  }
}));
