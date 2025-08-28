-- Create secure function to get facility owner for payment verification
CREATE OR REPLACE FUNCTION public.get_facility_owner_for_payment(facility_id_param uuid)
RETURNS TABLE(owner_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT f.owner_id 
  FROM facilities f
  WHERE f.id = facility_id_param 
    AND f.is_active = true
    AND auth.uid() IS NOT NULL; -- Only for authenticated users
$$;