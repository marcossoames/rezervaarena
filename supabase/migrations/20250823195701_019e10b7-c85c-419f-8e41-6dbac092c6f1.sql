-- Fix the get_owner_facility_details function to not require specific role
CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
RETURNS TABLE(
  id uuid, 
  owner_id uuid, 
  name text, 
  description text, 
  facility_type facility_type, 
  full_address text, 
  city text, 
  exact_price_per_hour numeric, 
  exact_capacity integer, 
  amenities text[], 
  images text[], 
  main_image_url text, 
  is_active boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Full sensitive data for facility owners viewing their own facilities
  -- Remove the role check since users start as 'client' role
  SELECT 
    f.id,
    f.owner_id,
    f.name,
    f.description,
    f.facility_type,
    f.address as full_address,
    f.city,
    f.price_per_hour as exact_price_per_hour,
    f.capacity as exact_capacity,
    f.amenities,
    f.images,
    f.main_image_url,
    f.is_active,
    f.created_at,
    f.updated_at
  FROM facilities f
  WHERE f.owner_id = auth.uid()
  ORDER BY f.created_at DESC;
$function$