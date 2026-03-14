import { lazy, Suspense } from 'react';

const SearchSection = lazy(() => import('@/components/SearchSection'));
const SportsSection = lazy(() => import('@/components/SportsSection'));
const FeaturesSection = lazy(() => import('@/components/FeaturesSection'));
const Footer = lazy(() => import('@/components/Footer'));

const MinimalLoader = () => (
  <div className="py-8">
    <div className="container mx-auto px-4">
      <div className="h-6 bg-muted rounded w-48 mx-auto mb-4 animate-pulse"></div>
      <div className="h-4 bg-muted rounded w-64 mx-auto animate-pulse"></div>
    </div>
  </div>
);

export const LazySearchSection = () => (
  <Suspense fallback={<MinimalLoader />}>
    <SearchSection />
  </Suspense>
);

export const LazySportsSection = () => (
  <Suspense fallback={<MinimalLoader />}>
    <SportsSection />
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
