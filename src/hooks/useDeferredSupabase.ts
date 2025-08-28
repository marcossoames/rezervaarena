import { useState, useEffect } from 'react';
import type { SupabaseClient, Session } from '@supabase/supabase-js';

/**
 * Hook to defer Supabase loading until needed, reducing initial bundle size
 * This helps eliminate unused JavaScript on the homepage
 */
export const useDeferredSupabase = () => {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Defer Supabase loading to reduce initial bundle size
    const loadSupabase = async () => {
      try {
        const { supabase: supabaseClient } = await import('@/integrations/supabase/client');
        setSupabase(supabaseClient);
        
        // Get initial session
        const { data: { session: initialSession } } = await supabaseClient.auth.getSession();
        setSession(initialSession);

        // Listen for auth changes
        const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
          (event, session) => {
            setSession(session);
          }
        );

        setLoading(false);

        return () => subscription.unsubscribe();
      } catch (error) {
        console.error('Failed to load Supabase:', error);
        setLoading(false);
      }
    };

    // Only load Supabase when the component actually needs it
    // This reduces initial bundle size for homepage
    const timer = setTimeout(loadSupabase, 100);
    return () => clearTimeout(timer);
  }, []);

  return { supabase, session, loading };
};

/**
 * Hook for components that need Supabase data fetching
 * Defers the actual data fetching until Supabase is loaded
 */
export const useDeferredSupabaseQuery = <T>(
  queryFn: (supabase: SupabaseClient) => Promise<T>,
  defaultValue: T
) => {
  const { supabase, loading: supabaseLoading } = useDeferredSupabase();
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase || supabaseLoading) return;

    const fetchData = async () => {
      try {
        const result = await queryFn(supabase);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, supabaseLoading, queryFn]);

  return { data, loading: loading || supabaseLoading, error };
};