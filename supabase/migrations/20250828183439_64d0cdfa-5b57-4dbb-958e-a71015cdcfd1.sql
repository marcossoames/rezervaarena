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