// Utility for managing lazy imports and reducing initial bundle size

/**
 * Lazy import wrapper that defers loading until the component is actually needed
 * This helps reduce the initial JavaScript bundle size for better performance
 */
export const createLazyImport = <T>(importFunc: () => Promise<T>) => {
  return () => importFunc();
};

/**
 * Preload a lazy component when it's likely to be needed soon
 * This can be called on user interactions like hover or scroll
 */
export const preloadComponent = async (importFunc: () => Promise<any>) => {
  try {
    await importFunc();
  } catch (error) {
    console.warn('Failed to preload component:', error);
  }
};

/**
 * Intersection Observer utility for lazy loading components when they come into view
 */
export const createIntersectionObserver = (
  callback: () => void,
  options: IntersectionObserverInit = { rootMargin: '100px' }
) => {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    // Fallback for environments without IntersectionObserver
    callback();
    return null;
  }

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback();
      }
    });
  }, options);
};