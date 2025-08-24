import { useState, useEffect, useCallback } from 'react';

interface ImageOptimizationHook {
  supportsWebP: boolean;
  supportsAVIF: boolean;
  isLoading: boolean;
  getOptimizedSrc: (src: string, options?: { width?: number; height?: number; quality?: number }) => string;
  preloadImage: (src: string, options?: { format?: 'webp' | 'avif' | 'jpeg'; fetchPriority?: 'high' | 'low' }) => void;
}

/**
 * Hook for image optimization with format detection and responsive loading
 */
export const useImageOptimization = (): ImageOptimizationHook => {
  const [supportsWebP, setSupportsWebP] = useState(false);
  const [supportsAVIF, setSupportsAVIF] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check browser support for modern image formats
  useEffect(() => {
    const checkImageFormatSupport = async () => {
      try {
        // Check WebP support
        const webpTest = new Image();
        const webpSupported = await new Promise<boolean>((resolve) => {
          webpTest.onload = () => resolve(webpTest.width === 2);
          webpTest.onerror = () => resolve(false);
          webpTest.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });

        // Check AVIF support
        const avifTest = new Image();
        const avifSupported = await new Promise<boolean>((resolve) => {
          avifTest.onload = () => resolve(avifTest.width === 2);
          avifTest.onerror = () => resolve(false);
          avifTest.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
        });

        setSupportsWebP(webpSupported);
        setSupportsAVIF(avifSupported);
      } catch (error) {
        console.warn('Error checking image format support:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkImageFormatSupport();
  }, []);

  // Get optimized image source based on browser support
  const getOptimizedSrc = useCallback((
    src: string, 
    options: { width?: number; height?: number; quality?: number } = {}
  ): string => {
    if (isLoading) return src; // Return original during loading

    const { width, height, quality = 85 } = options;
    let optimizedSrc = src;

    // Convert to WebP if supported (but not AVIF as it's not widely supported yet)
    if (supportsWebP && !src.includes('.webp')) {
      optimizedSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }

    // Add optimization parameters (in production, this would be handled by a CDN)
    const params = new URLSearchParams();
    if (width) params.set('w', width.toString());
    if (height) params.set('h', height.toString());
    if (quality !== 85) params.set('q', quality.toString());

    const queryString = params.toString();
    if (queryString) {
      const separator = optimizedSrc.includes('?') ? '&' : '?';
      optimizedSrc = `${optimizedSrc}${separator}${queryString}`;
    }

    return optimizedSrc;
  }, [supportsWebP, supportsAVIF, isLoading]);

  // Preload critical images
  const preloadImage = useCallback((
    src: string, 
    options: { format?: 'webp' | 'avif' | 'jpeg'; fetchPriority?: 'high' | 'low' } = {}
  ) => {
    const { format = 'webp', fetchPriority = 'high' } = options;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getOptimizedSrc(src);
    
    if (format === 'webp' && supportsWebP) {
      link.type = 'image/webp';
    } else if (format === 'avif' && supportsAVIF) {
      link.type = 'image/avif';
    }
    
    if (fetchPriority === 'high') {
      link.setAttribute('fetchpriority', 'high');
    }
    
    // Only add if not already exists
    const existingLink = document.querySelector(`link[href="${link.href}"]`);
    if (!existingLink) {
      document.head.appendChild(link);
    }
  }, [getOptimizedSrc, supportsWebP, supportsAVIF]);

  return {
    supportsWebP,
    supportsAVIF,
    isLoading,
    getOptimizedSrc,
    preloadImage
  };
};