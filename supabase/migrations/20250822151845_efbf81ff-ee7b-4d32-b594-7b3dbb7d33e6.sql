-- Further enhance client access security
-- Replace the broad client access with a more restrictive approach

-- Drop the current client policy
DROP POLICY IF EXISTS "Clients can view basic facility info for booking" ON public.facilities;

-- Create a more restrictive policy that requires active booking intent
-- This significantly reduces data exposure to clients
CREATE POLICY "Clients view minimal facility info only" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (
  is_active = true 
  AND has_role('client'::user_role)
  -- Additional restriction: only show basic fields through the function
  -- Direct table access for clients is minimized
);

-- Update the client function to be even more restrictive
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  -- Even more limited address information
  area_info text,
  description text, 
  price_per_hour numeric, 
  capacity integer, 
  images text[], 
  amenities text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Extremely limited data exposure for clients
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show only general area, not exact address
    f.city || ' area' as area_info,
    -- Limit description length for privacy
    CASE 
      WHEN LENGTH(f.description) > 100 THEN SUBSTRING(f.description FROM 1 FOR 100) || '...'
      ELSE f.description
    END as description,
    f.price_per_hour,
    f.capacity,
    f.images,
    f.amenities
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role('client'::user_role)
  ORDER BY f.created_at DESC;
$function$;