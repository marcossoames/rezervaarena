import { useState } from 'react';

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
  style,
}: OptimizedImageProps) => {
  const [imageError, setImageError] = useState(false);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      {...(fetchPriority !== 'auto' && { fetchpriority: fetchPriority })}
      width={width}
      height={height}
      style={style}
      decoding="async"
      onError={() => !imageError && setImageError(true)}
    />
  );
};