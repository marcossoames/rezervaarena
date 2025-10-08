-- Update get_facility_availability_secure to exclude old pending bookings (>10 min)
DROP FUNCTION IF EXISTS public.get_facility_availability_secure(uuid, date);

CREATE OR REPLACE FUNCTION public.get_facility_availability_secure(
  facility_id_param uuid, 
  booking_date_param date
)
RETURNS TABLE(
  start_time time without time zone, 
  end_time time without time zone, 
  unavailable_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data for authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Calculate timestamp for 10 minutes ago
  DECLARE
    ten_minutes_ago timestamp with time zone := now() - interval '10 minutes';
  BEGIN
    -- Return unavailable time slots without exposing sensitive booking details
    RETURN QUERY
    -- Only confirmed and recent pending bookings (<10 min old)
    SELECT 
      b.start_time,
      b.end_time,
      'booking'::text as unavailable_type
    FROM bookings b
    WHERE b.facility_id = facility_id_param 
      AND b.booking_date = booking_date_param
      AND (
        b.status = 'confirmed' 
        OR (b.status = 'pending' AND b.created_at >= ten_minutes_ago)
      )
    
    UNION ALL
    
    -- Blocked dates/times
    SELECT 
      COALESCE(bd.start_time, '00:00:00'::time) as start_time,
      COALESCE(bd.end_time, '23:59:59'::time) as end_time,
      'blocked'::text as unavailable_type
    FROM blocked_dates bd
    WHERE bd.facility_id = facility_id_param 
      AND bd.blocked_date = booking_date_param
    
    ORDER BY start_time;
  END;
END;
$$;