import { lazy, Suspense } from 'react';

// Lazy load heavy dependencies only when needed
const SearchSection = lazy(() => import('@/components/SearchSection'));

// Lightweight fallback component
const SearchSectionFallback = () => (
  <section className="py-16 bg-muted/20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-12 animate-pulse">
        <div className="h-8 bg-muted rounded w-64 mx-auto mb-4"></div>
        <div className="h-4 bg-muted rounded w-96 mx-auto"></div>
      </div>
      <div className="max-w-4xl mx-auto">
        <div className="bg-card rounded-lg shadow-elegant p-6 animate-pulse">
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