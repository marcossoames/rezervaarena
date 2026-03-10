import { useState } from 'react';

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
}: ResponsiveImageProps) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [imageError, setImageError] = useState(false);

  const getOptimalSizes = () => {
    if (sizes) return sizes;
    if (className?.includes('w-full')) return '100vw';
    if (className?.includes('h-48') || className?.includes('object-cover')) {
      return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 413px';
    }
    if (fetchPriority === 'high') {
      return '(max-width: 640px) 640px, (max-width: 768px) 768px, (max-width: 1024px) 1024px, (max-width: 1280px) 1280px, 1335px';
    }
    return '(max-width: 768px) 100vw, 50vw';
  };

  const handleError = () => {
    if (!imageError) {
      setImageError(true);
      setImageSrc(src);
    }
  };

  const webpSrc = src.replace(/\.(jpg|jpeg|png)$/i, '.webp');

  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" sizes={getOptimalSizes()} />
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
      />
    </picture>
  );
};