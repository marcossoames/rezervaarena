-- Drop and recreate the public browsing function with enhanced data
DROP FUNCTION public.get_facilities_for_public_browsing();

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing()
 RETURNS TABLE(
   id uuid, 
   name text, 
   facility_type facility_type, 
   city text, 
   area_info text, 
   description text, 
   price_per_hour numeric,
   capacity integer,
   amenities text[], 
   images text[]
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  -- Enhanced public data to encourage signups while maintaining reasonable security
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show general area without exact address for security
    f.city || ' area' as area_info,
    -- Show full description to help users make informed decisions
    f.description,
    -- Show exact pricing - essential for booking decisions
    f.price_per_hour,
    -- Show exact capacity - helps with group planning
    f.capacity,
    -- Show all amenities to highlight facility features
    f.amenities,
    -- Show images to make facilities attractive
    f.images
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$