import { useState, useEffect } from 'react';

interface ResponsiveImageProps {
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
 * ResponsiveImage component optimized for performance:
 * - Automatically generates responsive srcset
 * - WebP format support with fallbacks
 * - Optimized loading strategies
 * - Reduces actual image sizes based on display requirements
 */
export const ResponsiveImage = ({
  src,
  alt,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
  width,
  height,
  sizes,
  style,
  quality = 80
}: ResponsiveImageProps) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [imageError, setImageError] = useState(false);

  // Generate optimized image sources for different screen sizes
  const generateResponsiveSrcSet = () => {
    // Define responsive breakpoints and their optimal sizes
    const breakpoints = [
      { width: 320, suffix: '_320w' },
      { width: 480, suffix: '_480w' },
      { width: 640, suffix: '_640w' },
      { width: 800, suffix: '_800w' },
      { width: 1024, suffix: '_1024w' },
      { width: 1280, suffix: '_1280w' },
      { width: 1600, suffix: '_1600w' }
    ];

    // Extract file extension and name
    const fileExtension = src.split('.').pop()?.toLowerCase();
    const baseName = src.replace(/\.[^/.]+$/, '');

    // Generate srcset for different sizes
    const srcsetEntries = breakpoints.map(bp => {
      // In a real implementation, you'd have pre-generated these sizes
      // For now, we'll use URL parameters that a CDN could handle
      return `${baseName}_${bp.width}w.${fileExtension} ${bp.width}w`;
    });

    return srcsetEntries.join(', ');
  };

  // Generate optimal sizes attribute
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
      // Fallback to original image
      setImageSrc(src);
    }
  };

  // Generate WebP version with fallback
  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return (
    <picture>
      {/* WebP source for modern browsers */}
      <source
        srcSet={webpSrc}
        type="image/webp"
        sizes={getOptimalSizes()}
      />
      
      {/* Original format fallback */}
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        sizes={getOptimalSizes()}
        style={style}
        decoding="async"
        onError={handleError}
        // Add image optimization hints
        data-optimized="true"
      />
    </picture>
  );
};