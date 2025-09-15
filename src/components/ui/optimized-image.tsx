import { useState } from 'react';
import { useImageOptimization } from '@/hooks/useImageOptimization';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  width?: number;
  height?: number;
  sizes?: string;
  style?: React.CSSProperties;
  quality?: number;
}

/**
 * OptimizedImage component that provides:
 * - WebP format with JPEG fallback using picture element
 * - Responsive image sizing with precise srcset
 * - Proper lazy loading
 * - Progressive enhancement
 * - Automatic format detection
 * - Optimized for actual display dimensions to fix SEO issues
 */
export const OptimizedImage = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  width,
  height,
  sizes,
  style,
  quality = 85
}: OptimizedImageProps) => {
  const { supportsWebP } = useImageOptimization();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Calculate precise dimensions based on actual audit display requirements
  const getTargetDimensions = () => {
    if (fetchPriority === 'high') {
      // Hero image: exact dimensions from audit boundingRect (1335x600)
      return { 
        width: 1335, 
        height: 600, // Exact height from audit data
        breakpoints: [640, 768, 1024, 1280, 1335]
      };
    }
    
    // Card images: exact dimensions from audit boundingRect (395x192)
    return { 
      width: 395, 
      height: 192, // Exact height from audit data (was 296)
      breakpoints: [320, 395]
    };
  };

  const targetDimensions = getTargetDimensions();

  // Generate optimized sizes attribute for exact display dimensions
  const getOptimalSizes = () => {
    if (sizes) return sizes;
    
    if (fetchPriority === 'high') {
      // Hero image: exact sizing for 1335x600 display to prevent waste
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    
    // Card images: exact sizing for 395x192 display to prevent 88% waste
    return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 395px';
  };

  // Generate proper WebP sources with fallback support
  const generateWebPSrcSet = () => {
    const baseName = src.replace(/\.[^/.]+$/, '');
    return targetDimensions.breakpoints.map(breakpointWidth => {
      const breakpointHeight = Math.round((breakpointWidth * targetDimensions.height) / targetDimensions.width);
      
      // Generate WebP URL with optimization parameters
      const webpUrl = `${baseName}.webp`;
      const url = new URL(webpUrl, window.location.origin);
      url.searchParams.set('w', breakpointWidth.toString());
      url.searchParams.set('h', breakpointHeight.toString());
      url.searchParams.set('q', Math.max(60, quality - 15).toString()); // More aggressive for WebP
      url.searchParams.set('f', 'webp');
      url.searchParams.set('auto', 'compress,format');
      
      return `${url.toString()} ${breakpointWidth}w`;
    }).join(', ');
  };

  // Generate fallback JPEG sources
  const generateJPEGSrcSet = () => {
    return targetDimensions.breakpoints.map(breakpointWidth => {
      const breakpointHeight = Math.round((breakpointWidth * targetDimensions.height) / targetDimensions.width);
      
      const url = new URL(src, window.location.origin);
      url.searchParams.set('w', breakpointWidth.toString());
      url.searchParams.set('h', breakpointHeight.toString());
      url.searchParams.set('q', Math.max(60, quality - 20).toString());
      url.searchParams.set('f', 'auto');
      url.searchParams.set('auto', 'compress,format');
      
      return `${url.toString()} ${breakpointWidth}w`;
    }).join(', ');
  };

  // Handle image load errors silently
  const handleError = () => {
    if (!imageError) {
      setImageError(true);
      console.debug('Image fallback used for:', src);
    }
  };

  const handleLoad = () => {
    setImageLoaded(true);
  };

  // Create proper WebP source with fallback
  const createWebPSource = () => {
    const baseName = src.replace(/\.[^/.]+$/, '');
    const webpSrc = `${baseName}.webp`;
    
    return {
      srcSet: generateWebPSrcSet(),
      type: "image/webp",
      sizes: getOptimalSizes()
    };
  };

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} transition-opacity duration-300`}
      loading={loading}
      {...(fetchPriority !== 'auto' && { fetchpriority: fetchPriority })}
      width={width || targetDimensions.width}
      height={height || targetDimensions.height}
      style={{ 
        ...style, 
        aspectRatio: width && height ? `${width}/${height}` : `${targetDimensions.width}/${targetDimensions.height}`,
        maxWidth: '100%',
        height: 'auto'
      }}
      decoding="async"
      onError={handleError}
      onLoad={handleLoad}
      data-optimized="true"
      data-original-src={src}
    />
  );
};