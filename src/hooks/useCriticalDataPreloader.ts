import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CriticalDataPreloader {
  facilityStats: any[] | null;
  articles: any[] | null;
  isLoading: boolean;
  prefetchData: () => void;
}

// Global cache for preloaded data to avoid duplicate requests
const dataCache = {
  facilityStats: null as any[] | null,
  articles: null as any[] | null,
  facilityStatsPromise: null as any | null,
  articlesPromise: null as any | null,
};

/**
 * Hook for preloading critical API data to reduce request chain delays
 * This helps break the dependency chain: HTML → JS → Component Mount → API Call
 */
export const useCriticalDataPreloader = (): CriticalDataPreloader => {
  const [facilityStats, setFacilityStats] = useState<any[] | null>(dataCache.facilityStats);
  const [articles, setArticles] = useState<any[] | null>(dataCache.articles);
  const [isLoading, setIsLoading] = useState(false);

  // Function to prefetch critical data
  const prefetchData = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Prefetch facility stats if not already cached
      if (!dataCache.facilityStats && !dataCache.facilityStatsPromise) {
        dataCache.facilityStatsPromise = supabase.rpc('get_facility_stats_by_type');
      }
      
      // Prefetch articles if not already cached  
      if (!dataCache.articles && !dataCache.articlesPromise) {
        dataCache.articlesPromise = supabase
          .from('articles')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });
      }

      // Wait for both requests in parallel
      const [facilityStatsResult, articlesResult] = await Promise.allSettled([
        dataCache.facilityStatsPromise!,
        dataCache.articlesPromise!
      ]);

      // Handle facility stats
      if (facilityStatsResult.status === 'fulfilled' && facilityStatsResult.value.data) {
        dataCache.facilityStats = facilityStatsResult.value.data;
        setFacilityStats(facilityStatsResult.value.data);
      }

      // Handle articles
      if (articlesResult.status === 'fulfilled' && articlesResult.value.data) {
        dataCache.articles = articlesResult.value.data;
        setArticles(articlesResult.value.data);
      }

    } catch (error) {
      console.debug('Error prefetching critical data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-prefetch on component mount if data isn't already available
  useEffect(() => {
    if (!dataCache.facilityStats || !dataCache.articles) {
      prefetchData();
    }
  }, []);

  return {
    facilityStats,
    articles,
    isLoading,
    prefetchData
  };
};

/**
 * Get cached facility stats (for SportsSection component)
 */
export const getCachedFacilityStats = (): any[] | null => {
  return dataCache.facilityStats;
};

/**
 * Get cached articles (for ArticlesPage component)  
 */
export const getCachedArticles = (): any[] | null => {
  return dataCache.articles;
};

/**
 * Initialize data prefetching early in the app lifecycle
 * Call this in main.tsx or App.tsx to start prefetching immediately
 */
export const initializeCriticalDataPrefetch = () => {
  // Start prefetching immediately when the module loads
  if (typeof window !== 'undefined' && !dataCache.facilityStatsPromise) {
    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        // Prefetch facility stats
        if (!dataCache.facilityStatsPromise) {
          dataCache.facilityStatsPromise = supabase.rpc('get_facility_stats_by_type');
        }
        
        // Prefetch articles
        if (!dataCache.articlesPromise) {
          dataCache.articlesPromise = supabase
            .from('articles')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });
        }
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        if (!dataCache.facilityStatsPromise) {
          dataCache.facilityStatsPromise = supabase.rpc('get_facility_stats_by_type');
        }
        if (!dataCache.articlesPromise) {
          dataCache.articlesPromise = supabase
            .from('articles')
            .select('*')
            .eq('is_published', true)
            .order('created_at', { ascending: false });
        }
      }, 100);
    }
  }
};