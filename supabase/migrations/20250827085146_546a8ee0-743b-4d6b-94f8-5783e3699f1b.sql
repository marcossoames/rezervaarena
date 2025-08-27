-- Recreate all the functions that were dropped during enum update

CREATE OR REPLACE FUNCTION public.get_facility_stats_by_type()
 RETURNS TABLE(facility_type facility_type, facility_count bigint, min_price numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    f.facility_type,
    COUNT(*) as facility_count,
    MIN(f.price_per_hour) as min_price
  FROM facilities f
  WHERE f.is_active = true
  GROUP BY f.facility_type
  ORDER BY f.facility_type;
$function$;

CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, area_info text, description text, price_per_hour numeric, capacity integer, amenities text[], images text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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
$function$;

CREATE OR REPLACE FUNCTION public.get_facilities_for_authenticated_users()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, area_info text, description text, price_per_hour numeric, capacity integer, amenities text[], images text[], sports_complex_name text, sports_complex_address text, phone_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Enhanced data for authenticated users only
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.city || ' area' as area_info,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.amenities,
    f.images,
    -- Sports complex name
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă ' || SPLIT_PART(p.full_name, ' ', 1) || ' - ' || f.city
    END as sports_complex_name,
    -- Full address and contact info for authenticated users
    f.address || ', ' || f.city as sports_complex_address,
    p.phone as phone_number
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
$function$;