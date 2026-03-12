import { lazy, Suspense } from 'react';

const SearchSection = lazy(() => import('@/components/SearchSection'));

const SearchSectionFallback = () => (
  <section className="py-12 sm:py-16 bg-muted/20">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="text-center mb-8 sm:mb-12 animate-pulse">
        <div className="h-6 sm:h-8 bg-muted rounded w-48 sm:w-64 mx-auto mb-4"></div>
        <div className="h-3 sm:h-4 bg-muted rounded w-64 sm:w-96 mx-auto"></div>
      </div>
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-elegant p-4 sm:p-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-muted rounded"></div>
            ))}
          </div>
          <div className="mt-4">
            <div className="h-12 bg-primary/20 rounded w-full"></div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const OptimizedSearchSection = () => (
  <Suspense fallback={<SearchSectionFallback />}>
    <SearchSection />
  </Suspense>
);

export default OptimizedSearchSection;