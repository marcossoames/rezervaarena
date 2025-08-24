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
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-slot', '@radix-ui/react-toast']
        }
      }
    },
    // Compress assets without terser to avoid dependency issues
    assetsInlineLimit: 4096, // Inline small assets
    minify: 'esbuild' // Use esbuild instead of terser
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js']
  }
}));
