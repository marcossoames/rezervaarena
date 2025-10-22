import { lazy, Suspense } from 'react';

// Lazy load the full SportsSection with all dependencies
const SportsSection = lazy(() => import('@/components/SportsSection'));

// Lightweight fallback that shows the section structure
const SportsSectionFallback = () => (
  <section className="py-12 sm:py-16 lg:py-20 bg-secondary/20">
    <div className="container mx-auto px-4 sm:px-6">
      <div className="text-center mb-12 sm:mb-16 animate-pulse">
        <div className="h-8 sm:h-10 bg-muted rounded w-64 sm:w-80 mx-auto mb-4"></div>
        <div className="h-4 sm:h-5 bg-muted rounded w-72 sm:w-96 mx-auto"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg shadow-elegant overflow-hidden animate-pulse">
            <div className="h-48 bg-muted"></div>
            <div className="p-6">
              <div className="h-6 bg-muted rounded mb-4"></div>
              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-8"></div>
                </div>
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-16"></div>
                  <div className="h-4 bg-muted rounded w-20"></div>
                </div>
              </div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const OptimizedSportsSection = () => (
  <Suspense fallback={<SportsSectionFallback />}>
    <SportsSection />
  </Suspense>
);

export default OptimizedSportsSection;