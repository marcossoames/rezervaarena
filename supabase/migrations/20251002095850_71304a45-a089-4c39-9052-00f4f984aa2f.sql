-- Public function to expose unavailable time slots for a facility/date without PII
CREATE OR REPLACE FUNCTION public.get_facility_unavailable_slots_public(
  facility_id_param uuid,
  booking_date_param date
)
RETURNS TABLE (
  start_time time without time zone,
  end_time time without time zone,
  unavailable_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Return bookings (only times, no client info) for the given facility/date
  RETURN QUERY
  SELECT 
    b.start_time,
    b.end_time,
    'booking'::text AS unavailable_type
  FROM public.bookings b
  WHERE b.facility_id = facility_id_param
    AND b.booking_date = booking_date_param
    AND b.status IN ('confirmed','pending');

  -- Return blocked intervals for the given facility/date (full day blocks mapped to 00:00-24:00)
  RETURN QUERY
  SELECT 
    COALESCE(bd.start_time, TIME '00:00') AS start_time,
    COALESCE(bd.end_time, TIME '24:00')   AS end_time,
    'blocked'::text AS unavailable_type
  FROM public.blocked_dates bd
  WHERE bd.facility_id = facility_id_param
    AND bd.blocked_date = booking_date_param;
END;
$$;