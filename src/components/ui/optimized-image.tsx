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
 * - WebP format with JPEG fallback
 * - Responsive image sizing
 * - Proper lazy loading
 * - Progressive enhancement
 * - Automatic format detection
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
  const { supportsWebP, getOptimizedSrc, isLoading } = useImageOptimization();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Generate optimal sizes if not provided
  const getOptimalSizes = () => {
    if (sizes) return sizes;
    
    // Smart defaults based on common layout patterns
    if (className?.includes('w-full')) {
      return '100vw';
    }
    
    // For card images in grid layouts
    if (className?.includes('h-48') || className?.includes('object-cover')) {
      return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 413px';
    }
    
    // For hero images
    if (fetchPriority === 'high') {
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    
    return '(max-width: 768px) 100vw, 50vw';
  };

  // Handle image load errors
  const handleError = () => {
    if (!imageError) {
      setImageError(true);
    }
  };

  const handleLoad = () => {
    setImageLoaded(true);
  };

  // Get optimized source URLs
  const webpSrc = supportsWebP ? getOptimizedSrc(src.replace(/\.(jpg|jpeg|png)$/i, '.webp'), { width, height, quality }) : '';
  const fallbackSrc = getOptimizedSrc(src, { width, height, quality });

  return (
    <picture>
      {/* WebP source for modern browsers */}
      {supportsWebP && !imageError && (
        <source
          srcSet={webpSrc}
          type="image/webp"
          sizes={getOptimalSizes()}
        />
      )}
      
      {/* Original format fallback */}
      <img
        src={imageError ? src : fallbackSrc}
        alt={alt}
        className={`${className} ${!imageLoaded && loading === 'lazy' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        loading={loading}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        sizes={getOptimalSizes()}
        style={style}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        // Add optimization attributes
        data-optimized="true"
        data-original-src={src}
      />
    </picture>
  );
};