import { lazy, Suspense } from 'react';

// Lazy load below-the-fold components with minimal vendor bundle usage
const OptimizedSearchSection = lazy(() => import('@/components/OptimizedSearchSection'));
const OptimizedSportsSection = lazy(() => import('@/components/OptimizedSportsSection'));
const FeaturesSection = lazy(() => import('@/components/FeaturesSection'));
const Footer = lazy(() => import('@/components/Footer'));

// Ultra-minimal loading fallbacks to reduce initial bundle size
const MinimalLoader = () => (
  <div className="h-20 bg-muted/20 animate-pulse" />
);

// Wrapper components with minimal loading states
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
  <Suspense fallback={<div className="h-16 bg-muted/20" />}>
    <Footer />
  </Suspense>
);