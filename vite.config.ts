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
  // Asset handling for modern image formats and responsive images
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
          
          // Organize images by display size for better caching
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
        manualChunks: (id) => {
          // Core React dependencies - essential for all pages
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'react-vendor';
          }
          
          // Critical UI components needed immediately
          if (id.includes('@radix-ui/react-slot') || id.includes('class-variance-authority')) {
            return 'ui-critical';
          }
          
          // Non-critical UI components (dialogs, dropdowns, etc.)
          if (id.includes('@radix-ui') && !id.includes('slot')) {
            return 'ui-vendor';
          }
          
          // Supabase - only loaded when needed for auth/data
          if (id.includes('@supabase/supabase-js')) {
            return 'supabase-vendor';
          }
          
          // Query client - only for data fetching
          if (id.includes('@tanstack/react-query')) {
            return 'query-vendor';
          }
          
          // Form handling - only loaded with forms
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-vendor';
          }
          
          // Charts - only loaded with dashboards
          if (id.includes('recharts')) {
            return 'chart-vendor';
          }
          
          // Icons - frequently used, small chunk
          if (id.includes('lucide-react')) {
            return 'icon-vendor';
          }
          
          // Date utilities - loaded with calendars
          if (id.includes('date-fns') || id.includes('react-day-picker')) {
            return 'date-vendor';
          }
          
          // Node modules vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
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
