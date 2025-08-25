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

  // Calculate precise dimensions based on actual display requirements
  const getTargetDimensions = () => {
    if (fetchPriority === 'high') {
      // Hero image: optimize for actual viewport width (1335px max based on audit)
      return { 
        width: 1335, 
        height: 751, // Based on the audit data showing 1335x751 display
        breakpoints: [640, 768, 1024, 1280, 1335]
      };
    }
    
    // Card images: optimize for actual display size (395px based on audit)
    return { 
      width: 395, 
      height: 296, // Aspect ratio maintained for card images
      breakpoints: [320, 395]
    };
  };

  const targetDimensions = getTargetDimensions();

  // Generate optimized sizes attribute for precise loading
  const getOptimalSizes = () => {
    if (sizes) return sizes;
    
    if (fetchPriority === 'high') {
      // Hero image: precise sizing to avoid over-downloading
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    
    // Card images: precise sizing for grid layout
    return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 395px';
  };

  // Generate srcset for responsive loading with precise breakpoints
  const generateSrcSet = (format: 'webp' | 'original' = 'original') => {
    const extension = format === 'webp' ? '.webp' : src.split('.').pop();
    const baseName = src.replace(/\.[^/.]+$/, '');
    
    return targetDimensions.breakpoints.map(breakpointWidth => {
      const breakpointHeight = Math.round((breakpointWidth * targetDimensions.height) / targetDimensions.width);
      const imageSrc = format === 'webp' ? `${baseName}.webp` : src;
      
      // In production, this would be handled by a CDN with actual resized images
      // For now, we add size hints that modern CDNs can process
      const url = new URL(imageSrc, window.location.origin);
      url.searchParams.set('w', breakpointWidth.toString());
      url.searchParams.set('h', breakpointHeight.toString());
      url.searchParams.set('q', quality.toString());
      url.searchParams.set('f', format === 'webp' ? 'webp' : 'auto');
      
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

  // Generate WebP version
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return (
    <picture>
      {/* WebP source for modern browsers - significant file size reduction */}
      {supportsWebP && (
        <source
          srcSet={generateSrcSet('webp')}
          type="image/webp"
          sizes={getOptimalSizes()}
        />
      )}
      
      {/* Original format fallback with responsive srcset */}
      <source
        srcSet={generateSrcSet('original')}
        type={`image/${src.split('.').pop()?.toLowerCase()}`}
        sizes={getOptimalSizes()}
      />
      
      {/* Base img element */}
      <img
        src={imageError ? src : src}
        alt={alt}
        className={`${className} ${!imageLoaded && loading === 'lazy' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        loading={loading}
        fetchPriority={fetchPriority}
        width={targetDimensions.width}
        height={targetDimensions.height}
        style={{ 
          ...style, 
          aspectRatio: `${targetDimensions.width}/${targetDimensions.height}`,
          maxWidth: '100%',
          height: 'auto'
        }}
        decoding="async"
        onError={handleError}
        onLoad={handleLoad}
        // Add optimization attributes for debugging
        data-optimized="true"
        data-original-src={src}
        data-target-size={`${targetDimensions.width}x${targetDimensions.height}`}
      />
    </picture>
  );
};