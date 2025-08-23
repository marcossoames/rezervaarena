-- Fix the sports complex name extraction logic
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing();

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
   images text[],
   sports_complex_name text,
   sports_complex_address text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
    f.images,
    -- Extract sports complex name from owner profile with better logic
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă ' || SPLIT_PART(p.full_name, ' ', 1) || ' - ' || f.city
    END as sports_complex_name,
    -- Show complete address for better user experience
    f.address || ', ' || f.city as sports_complex_address
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$