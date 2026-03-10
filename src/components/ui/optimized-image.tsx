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

  const getTargetDimensions = () => {
    if (fetchPriority === 'high') {
      return { width: 1335, height: 600, breakpoints: [640, 768, 1024, 1280, 1335] };
    }
    return { width: 395, height: 192, breakpoints: [320, 395] };
  };

  const targetDimensions = getTargetDimensions();

  const getOptimalSizes = () => {
    if (sizes) return sizes;
    if (fetchPriority === 'high') {
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 395px';
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
      onError={() => !imageError && setImageError(true)}
      onLoad={() => setImageLoaded(true)}
    />
  );
};