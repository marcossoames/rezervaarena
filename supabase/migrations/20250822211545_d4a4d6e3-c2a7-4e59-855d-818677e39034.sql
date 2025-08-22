-- Create a public function to get facility counts and minimum prices by type
-- This function only returns aggregated data, not specific facility details
CREATE OR REPLACE FUNCTION public.get_facility_stats_by_type()
RETURNS TABLE(
  facility_type facility_type,
  facility_count bigint,
  min_price numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    f.facility_type,
    COUNT(*) as facility_count,
    MIN(f.price_per_hour) as min_price
  FROM facilities f
  WHERE f.is_active = true
  GROUP BY f.facility_type
  ORDER BY f.facility_type;
$$;