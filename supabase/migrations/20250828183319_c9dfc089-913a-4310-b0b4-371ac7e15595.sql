-- Re-attach missing booking integrity triggers
CREATE TRIGGER booking_validation_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_overlap();

CREATE TRIGGER booking_protection_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_integrity();

-- Create secure RPC for facility availability checks
CREATE OR REPLACE FUNCTION public.get_facility_availability_secure(facility_id_param uuid, booking_date_param date)
RETURNS TABLE(
  start_time time without time zone,
  end_time time without time zone,
  unavailable_type text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only return data for authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Return unavailable time slots without exposing sensitive booking details
  RETURN QUERY
  -- Confirmed and pending bookings
  SELECT 
    b.start_time,
    b.end_time,
    'booking'::text as unavailable_type
  FROM bookings b
  WHERE b.facility_id = facility_id_param 
    AND b.booking_date = booking_date_param
    AND b.status IN ('confirmed', 'pending')
  
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
$function$

-- Create secure facility read function for payment processing
CREATE OR REPLACE FUNCTION public.get_facility_for_payment_processing(facility_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text, 
  price_per_hour numeric,
  owner_id uuid,
  is_active boolean,
  operating_hours_start time without time zone,
  operating_hours_end time without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return facility data needed for payment processing
  -- Uses SECURITY DEFINER to bypass RLS for internal operations
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.price_per_hour,
    f.owner_id,
    f.is_active,
    f.operating_hours_start,
    f.operating_hours_end
  FROM facilities f
  WHERE f.id = facility_id_param 
    AND f.is_active = true;
END;
$function$