import { lazy, Suspense } from 'react';

const OptimizedSearchSection = lazy(() => import('@/components/OptimizedSearchSection'));
const FeaturesSection = lazy(() => import('@/components/FeaturesSection'));
const Footer = lazy(() => import('@/components/Footer'));

const SimpleLoader = () => <div className="h-20" />;

export const LazySearchSection = () => (
  <Suspense fallback={<SimpleLoader />}>
    <OptimizedSearchSection />
  </Suspense>
);

export const LazyFeaturesSection = () => (
  <Suspense fallback={<SimpleLoader />}>
    <FeaturesSection />
  </Suspense>
);

export const LazyFooter = () => (
  <Suspense fallback={<SimpleLoader />}>
    <Footer />
  </Suspense>
);