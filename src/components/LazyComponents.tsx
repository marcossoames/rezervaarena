import { lazy, Suspense } from 'react';

// Lazy load below-the-fold components with optimized imports to reduce vendor bundle usage
const OptimizedSearchSection = lazy(() => import('@/components/OptimizedSearchSection'));
const OptimizedSportsSection = lazy(() => import('@/components/OptimizedSportsSection'));
const FeaturesSection = lazy(() => import('@/components/FeaturesSection'));
const Footer = lazy(() => import('@/components/Footer'));

// Minimal loading fallbacks to prevent layout shift
const MinimalLoader = () => (
  <div className="py-8">
    <div className="container mx-auto px-4">
      <div className="h-6 bg-muted rounded w-48 mx-auto mb-4 animate-pulse"></div>
      <div className="h-4 bg-muted rounded w-64 mx-auto animate-pulse"></div>
    </div>
  </div>
);

// Wrapper components with optimized loading
export const LazySearchSection = () => (
  <Suspense fallback={<MinimalLoader />}>
    <OptimizedSearchSection />
  </Suspense>
);

export const LazySportsSection = () => (
  <Suspense fallback={<MinimalLoader />}>
    <OptimizedSportsSection />
  </Suspense>
);

export const LazyFeaturesSection = () => (
  <Suspense fallback={<MinimalLoader />}>
    <FeaturesSection />
  </Suspense>
);

export const LazyFooter = () => (
  <Suspense fallback={<div className="h-20 bg-muted animate-pulse"></div>}>
    <Footer />
  </Suspense>
);