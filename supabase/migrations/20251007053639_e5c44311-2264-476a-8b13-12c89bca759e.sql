-- Create a secure function to get booking counts per facility
-- This allows public access to aggregated data without exposing booking details
CREATE OR REPLACE FUNCTION public.get_facility_booking_counts()
RETURNS TABLE(facility_id uuid, booking_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    b.facility_id,
    COUNT(*) as booking_count
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'pending', 'completed')
  GROUP BY b.facility_id;
$$;