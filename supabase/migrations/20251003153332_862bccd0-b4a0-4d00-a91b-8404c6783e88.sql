-- Create a secure public function to check if facilities are fully unavailable on specific dates
-- This allows unauthenticated visitors to see X marks on calendar without exposing sensitive data

CREATE OR REPLACE FUNCTION public.get_fully_unavailable_dates_public(
  facility_ids_param uuid[]
)
RETURNS TABLE (
  blocked_date date,
  fully_blocked_count bigint,
  partially_blocked_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return aggregated availability information for calendar display
  -- Does NOT expose facility_id, reasons, times, or any PII
  -- Only shows if dates are fully/partially blocked across all requested facilities
  
  RETURN QUERY
  WITH blocked_info AS (
    SELECT 
      bd.blocked_date,
      bd.facility_id,
      CASE 
        WHEN bd.start_time IS NULL AND bd.end_time IS NULL THEN 'full_day'
        ELSE 'partial'
      END AS block_type
    FROM public.blocked_dates bd
    WHERE bd.facility_id = ANY(facility_ids_param)
  )
  SELECT 
    bi.blocked_date,
    COUNT(DISTINCT CASE WHEN bi.block_type = 'full_day' THEN bi.facility_id END) AS fully_blocked_count,
    COUNT(DISTINCT CASE WHEN bi.block_type = 'partial' THEN bi.facility_id END) AS partially_blocked_count
  FROM blocked_info bi
  GROUP BY bi.blocked_date;
END;
$$;

-- Grant execute permission to anonymous users (for public calendar viewing)
GRANT EXECUTE ON FUNCTION public.get_fully_unavailable_dates_public(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_fully_unavailable_dates_public(uuid[]) TO authenticated;