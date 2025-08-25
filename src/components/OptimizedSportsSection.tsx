import { lazy, Suspense } from 'react';

// Lazy load the full SportsSection with all dependencies
const SportsSection = lazy(() => import('@/components/SportsSection'));

// Lightweight fallback that shows the section structure
const SportsSectionFallback = () => (
  <section className="py-20 bg-secondary/20">
    <div className="container mx-auto px-4">
      <div className="text-center mb-16 animate-pulse">
        <div className="h-10 bg-muted rounded w-80 mx-auto mb-4"></div>
        <div className="h-5 bg-muted rounded w-96 mx-auto"></div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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