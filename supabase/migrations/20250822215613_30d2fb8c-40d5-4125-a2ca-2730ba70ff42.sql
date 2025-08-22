-- Simplify the client booking function to remove restrictive role check
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
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
  -- Enhanced data for authenticated users - show exact pricing and capacity for booking decisions
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show general area without exact address for security
    f.city || ' area' as area_info,
    -- Show full description for informed decisions
    f.description,
    -- Show exact pricing for booking calculations
    f.price_per_hour,
    -- Show exact capacity for group planning
    f.capacity,
    -- Show all amenities to highlight facility features
    f.amenities,
    -- Show images for visual decision making
    f.images
  FROM facilities f
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
$function$