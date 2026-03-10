import { useState, useEffect, useCallback } from 'react';

export const useImageOptimization = () => {
  const [supportsWebP, setSupportsWebP] = useState(false);
  const [supportsAVIF, setSupportsAVIF] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkFormats = async () => {
      try {
        const webpTest = new Image();
        const webpSupported = await new Promise<boolean>((resolve) => {
          webpTest.onload = () => resolve(webpTest.width === 2);
          webpTest.onerror = () => resolve(false);
          webpTest.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });

        const avifTest = new Image();
        const avifSupported = await new Promise<boolean>((resolve) => {
          avifTest.onload = () => resolve(avifTest.width === 2);
          avifTest.onerror = () => resolve(false);
          avifTest.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAABcAAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQAMAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAAB9tZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
        });

        setSupportsWebP(webpSupported);
        setSupportsAVIF(avifSupported);
      } catch {
        // fallback: assume no support
      } finally {
        setIsLoading(false);
      }
    };

    checkFormats();
  }, []);

  const getOptimizedSrc = useCallback((
    src: string, 
    options: { width?: number; height?: number; quality?: number } = {}
  ): string => {
    if (isLoading) return src;

    const { width, height, quality = 85 } = options;
    let optimizedSrc = src;

    if (supportsWebP && !src.includes('.webp')) {
      optimizedSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    }

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

  const preloadImage = useCallback((
    src: string, 
    options: { format?: 'webp' | 'avif' | 'jpeg'; fetchPriority?: 'high' | 'low' } = {}
  ) => {
    const { format = 'webp', fetchPriority = 'high' } = options;
    
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = getOptimizedSrc(src);
    
    if (format === 'webp' && supportsWebP) link.type = 'image/webp';
    else if (format === 'avif' && supportsAVIF) link.type = 'image/avif';
    
    if (fetchPriority === 'high') link.setAttribute('fetchpriority', 'high');
    
    if (!document.querySelector(`link[href="${link.href}"]`)) {
      document.head.appendChild(link);
    }
  }, [getOptimizedSrc, supportsWebP, supportsAVIF]);

  return { supportsWebP, supportsAVIF, isLoading, getOptimizedSrc, preloadImage };
};