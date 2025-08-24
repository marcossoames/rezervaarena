/**
 * Image optimization utilities for better performance
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill';
}

/**
 * Generate optimized image URL with query parameters
 * In production, this would integrate with a CDN like Cloudinary, ImageKit, etc.
 */
export const getOptimizedImageUrl = (
  src: string, 
  options: ImageOptimizationOptions = {}
): string => {
  const { width, height, quality = 80, format = 'webp', fit = 'cover' } = options;
  
  // For now, we'll add optimization hints as URL parameters
  // In production, replace this with your CDN's URL structure
  const params = new URLSearchParams();
  
  if (width) params.set('w', width.toString());
  if (height) params.set('h', height.toString());
  if (quality !== 80) params.set('q', quality.toString());
  if (format !== 'webp') params.set('f', format);
  if (fit !== 'cover') params.set('fit', fit);
  
  const queryString = params.toString();
  const separator = src.includes('?') ? '&' : '?';
  
  return queryString ? `${src}${separator}${queryString}` : src;
};

/**
 * Generate responsive srcset for multiple screen densities
 */
export const generateResponsiveSrcSet = (
  src: string,
  sizes: number[] = [400, 600, 800, 1200, 1600]
): string => {
  return sizes
    .map(size => {
      const optimizedUrl = getOptimizedImageUrl(src, { width: size });
      return `${optimizedUrl} ${size}w`;
    })
    .join(', ');
};

/**
 * Check if browser supports modern image formats
 */
export const checkImageFormatSupport = async (): Promise<{
  webp: boolean;
  avif: boolean;
}> => {
  const checkFormat = (format: string, dataUri: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.width === 2);
      img.onerror = () => resolve(false);
      img.src = dataUri;
    });
  };

  const [webp, avif] = await Promise.all([
    checkFormat(
      'webp',
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA'
    ),
    checkFormat(
      'avif',
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI='
    )
  ]);

  return { webp, avif };
};

/**
 * Preload critical images for better LCP
 */
export const preloadImage = (src: string, options: ImageOptimizationOptions = {}): void => {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = getOptimizedImageUrl(src, options);
  
  if (options.format === 'webp') {
    link.type = 'image/webp';
  } else if (options.format === 'avif') {
    link.type = 'image/avif';
  }
  
  document.head.appendChild(link);
};

/**
 * Lazy load images with intersection observer
 */
export const setupLazyLoading = (): void => {
  if ('loading' in HTMLImageElement.prototype) {
    // Native lazy loading is supported
    return;
  }

  // Fallback for browsers without native lazy loading
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          imageObserver.unobserve(img);
        }
      }
    });
  });

  // Observe all images with data-src attribute
  document.querySelectorAll('img[data-src]').forEach((img) => {
    imageObserver.observe(img);
  });
};