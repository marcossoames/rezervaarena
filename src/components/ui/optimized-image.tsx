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
    
    // More precise sizing based on actual display dimensions
    if (fetchPriority === 'high') {
      // Hero image: optimize for actual display size (1335px max width)
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    
    // Card images: optimize for 413px display width
    if (className?.includes('h-48') || className?.includes('object-cover')) {
      return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 413px';
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

  // Get optimized source URLs with proper dimensions
  const getOptimizedImageSrc = (src: string, targetWidth: number) => {
    // In a real implementation, this would generate different sized images
    // For now, we use the original image with size hints via URL parameters
    const url = new URL(src, window.location.origin);
    url.searchParams.set('w', targetWidth.toString());
    url.searchParams.set('q', quality.toString());
    return url.toString();
  };

  // Calculate optimal display dimensions
  const getTargetDimensions = () => {
    if (fetchPriority === 'high') {
      // Hero image: target actual viewport width (max 1335px)
      return { width: Math.min(1335, width || 1920), height: Math.round((Math.min(1335, width || 1920) * (height || 864)) / (width || 1920)) };
    }
    
    // Card images: target 413px width (actual display size)
    return { width: 413, height: Math.round((413 * (height || 372)) / (width || 800)) };
  };

  const targetDimensions = getTargetDimensions();
  const webpSrc = supportsWebP ? getOptimizedImageSrc(src.replace(/\.(jpg|jpeg|png)$/i, '.webp'), targetDimensions.width) : '';
  const fallbackSrc = getOptimizedImageSrc(src, targetDimensions.width);

  return (
    <picture>
      {/* WebP source for modern browsers with optimized sizing */}
      {supportsWebP && !imageError && (
        <source
          srcSet={`${webpSrc} ${targetDimensions.width}w`}
          type="image/webp"
          sizes={getOptimalSizes()}
        />
      )}
      
      {/* Original format fallback with optimized sizing */}
      <img
        src={imageError ? src : fallbackSrc}
        alt={alt}
        className={`${className} ${!imageLoaded && loading === 'lazy' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        loading={loading}
        fetchPriority={fetchPriority}
        width={targetDimensions.width}
        height={targetDimensions.height}
        sizes={getOptimalSizes()}
        style={{ ...style, aspectRatio: `${targetDimensions.width}/${targetDimensions.height}` }}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        // Add optimization attributes
        data-optimized="true"
        data-original-src={src}
        data-target-size={`${targetDimensions.width}x${targetDimensions.height}`}
      />
    </picture>
  );
};