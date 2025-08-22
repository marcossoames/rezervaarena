-- Update the public browsing function to show more useful information while keeping it secure
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
    -- Show general area without exact address
    f.city || ' area' as area_info,
    -- Show full description to help users make decisions
    f.description,
    -- Show exact pricing to help with decision making
    f.price_per_hour,
    -- Show exact capacity 
    f.capacity,
    -- Show all amenities to highlight facility features
    f.amenities,
    -- Show images to make facilities attractive
    f.images
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$