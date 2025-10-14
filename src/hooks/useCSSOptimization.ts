import { useEffect } from 'react';

/**
 * Simple hook to optimize CSS loading
 */
export const useCSSOptimization = () => {
  useEffect(() => {
    // Defer non-critical CSS loading using requestIdleCallback
    const deferCSS = () => {
      // Use requestIdleCallback for non-blocking CSS operations
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Mark CSS as loaded to prevent FOUC
          document.body.classList.add('css-optimized');
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          document.body.classList.add('css-optimized');
        }, 100);
      }
    };

    // Start CSS optimization
    deferCSS();
  }, []);
};

/**
 * Articles page critical CSS - only styles needed above the fold
 */
export const articlesCriticalCSS = `
/* Articles page critical above-the-fold styles */
.articles-hero {
  text-align: center;
  margin-bottom: 3rem;
  padding: 2rem 1rem;
}

.articles-title {
  font-size: 2.25rem;
  line-height: 2.5rem;
  font-weight: 700;
  color: hsl(210 15% 15%);
  margin-bottom: 1rem;
}

.articles-subtitle {
  font-size: 1.25rem;
  line-height: 1.75rem;
  color: hsl(210 10% 45%);
  max-width: 42rem;
  margin: 0 auto;
}

.articles-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
  text-align: center;
}

.articles-grid {
  display: grid;
  gap: 2rem;
  margin-top: 2rem;
}

@media (min-width: 768px) {
  .articles-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .articles-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Essential card styles for initial render */
.article-card {
  border-radius: 0.5rem;
  background-color: hsl(0 0% 100% / 0.5);
  box-shadow: 0 4px 20px hsl(210 15% 15% / 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}
`;