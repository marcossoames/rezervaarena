import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const dataCache = {
  facilityStats: null as any[] | null,
  articles: null as any[] | null,
  facilityStatsPromise: null as any | null,
  articlesPromise: null as any | null,
};

export const useCriticalDataPreloader = () => {
  const [facilityStats, setFacilityStats] = useState<any[] | null>(dataCache.facilityStats);
  const [articles, setArticles] = useState<any[] | null>(dataCache.articles);
  const [isLoading, setIsLoading] = useState(false);

  const prefetchData = async () => {
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      if (!dataCache.facilityStats && !dataCache.facilityStatsPromise) {
        dataCache.facilityStatsPromise = supabase.rpc('get_facility_stats_by_type');
      }
      
      if (!dataCache.articles && !dataCache.articlesPromise) {
        dataCache.articlesPromise = supabase
          .from('articles')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });
      }

      const [facilityStatsResult, articlesResult] = await Promise.allSettled([
        dataCache.facilityStatsPromise!,
        dataCache.articlesPromise!
      ]);

      if (facilityStatsResult.status === 'fulfilled' && facilityStatsResult.value.data) {
        dataCache.facilityStats = facilityStatsResult.value.data;
        setFacilityStats(facilityStatsResult.value.data);
      }

      if (articlesResult.status === 'fulfilled' && articlesResult.value.data) {
        dataCache.articles = articlesResult.value.data;
        setArticles(articlesResult.value.data);
      }
    } catch (error) {
      console.debug('Prefetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!dataCache.facilityStats || !dataCache.articles) {
      prefetchData();
    }
  }, []);

  return { facilityStats, articles, isLoading, prefetchData };
};

export const getCachedFacilityStats = (): any[] | null => dataCache.facilityStats;

export const getCachedArticles = (): any[] | null => dataCache.articles;

export const initializeCriticalDataPrefetch = () => {
  if (typeof window === 'undefined' || dataCache.facilityStatsPromise) return;

  const prefetch = () => {
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
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetch);
  } else {
    setTimeout(prefetch, 100);
  }
};