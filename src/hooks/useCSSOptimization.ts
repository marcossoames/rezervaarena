import { useEffect } from 'react';

export const useCSSOptimization = () => {
  useEffect(() => {
    const apply = () => document.body.classList.add('css-optimized');

    if ('requestIdleCallback' in window) {
      requestIdleCallback(apply);
    } else {
      setTimeout(apply, 100);
    }
  }, []);
};

export const articlesCriticalCSS = `
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

.article-card {
  border-radius: 0.5rem;
  background-color: hsl(0 0% 100% / 0.5);
  box-shadow: 0 4px 20px hsl(210 15% 15% / 0.1);
  overflow: hidden;
  transition: all 0.3s ease;
}
`;