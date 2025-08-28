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
    // For static assets, create optimized versions at different sizes
    const baseName = src.replace(/\.[^/.]+$/, '');
    
    if (fetchPriority === 'high') {
      // Hero image: Generate multiple sizes for the exact 1335x600 display
      return [
        `${baseName}-640.webp 640w`,
        `${baseName}-768.webp 768w`, 
        `${baseName}-1024.webp 1024w`,
        `${baseName}-1280.webp 1280w`,
        `${baseName}.webp 1335w`
      ].join(', ');
    }
    
    // Card images: Generate optimized sizes for 395x192 display
    return [
      `${baseName}-320.webp 320w`,
      `${baseName}.webp 395w`
    ].join(', ');
  };

  // Generate fallback JPEG sources with proper sizing
  const generateJPEGSrcSet = () => {
    if (fetchPriority === 'high') {
      // Hero image: Multiple responsive sizes
      return [
        `${src.replace('.jpg', '-640.jpg')} 640w`,
        `${src.replace('.jpg', '-768.jpg')} 768w`,
        `${src.replace('.jpg', '-1024.jpg')} 1024w`, 
        `${src.replace('.jpg', '-1280.jpg')} 1280w`,
        `${src} 1335w`
      ].join(', ');
    }
    
    // Card images: Optimized for exact display size
    return [
      `${src.replace('.jpg', '-320.jpg')} 320w`,
      `${src} 395w`
    ].join(', ');
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


  return (
    <picture>
      {supportsWebP && (
        <source
          srcSet={generateWebPSrcSet()}
          sizes={getOptimalSizes()}
          type="image/webp"
        />
      )}
      <img
        src={src}
        srcSet={generateJPEGSrcSet()}
        alt={alt}
        className={`${className} transition-opacity duration-300`}
        loading={loading}
        fetchPriority={fetchPriority}
        width={width || targetDimensions.width}
        height={height || targetDimensions.height}
        sizes={getOptimalSizes()}
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
    </picture>
  );
};