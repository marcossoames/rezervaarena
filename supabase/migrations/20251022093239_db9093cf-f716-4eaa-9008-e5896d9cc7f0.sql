-- Drop and recreate get_facilities_for_authenticated_users with promotion_only
DROP FUNCTION IF EXISTS public.get_facilities_for_authenticated_users();

CREATE OR REPLACE FUNCTION public.get_facilities_for_authenticated_users()
 RETURNS TABLE(
   id uuid,
   name text,
   facility_type facility_type,
   city text,
   address text,
   description text,
   price_per_hour numeric,
   capacity integer,
   capacity_max integer,
   images text[],
   main_image_url text,
   sports_complex_name text,
   sports_complex_address text,
   sports_complex_description text,
   operating_hours_start time without time zone,
   operating_hours_end time without time zone,
   amenities text[],
   general_services text[],
   allowed_durations integer[],
   created_at timestamp with time zone,
   promotion_only boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.images,
    f.main_image_url,
    CASE 
      WHEN sc.name IS NOT NULL THEN sc.name
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END AS sports_complex_name,
    f.address AS sports_complex_address,
    sc.description AS sports_complex_description,
    f.operating_hours_start,
    f.operating_hours_end,
    f.amenities,
    COALESCE(sc.general_services, '{}') AS general_services,
    COALESCE(f.allowed_durations, ARRAY[60,90,120]::integer[]) AS allowed_durations,
    f.created_at,
    f.promotion_only
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$function$;

-- Drop and recreate get_facilities_for_public_browsing_safe with promotion_only
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
 RETURNS TABLE(
   id uuid,
   name text,
   facility_type facility_type,
   city text,
   address text,
   description text,
   price_per_hour numeric,
   capacity integer,
   capacity_max integer,
   images text[],
   main_image_url text,
   sports_complex_name text,
   sports_complex_address text,
   sports_complex_description text,
   operating_hours_start time without time zone,
   operating_hours_end time without time zone,
   amenities text[],
   general_services text[],
   allowed_durations integer[],
   created_at timestamp with time zone,
   promotion_only boolean
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.images,
    f.main_image_url,
    CASE 
      WHEN sc.name IS NOT NULL THEN sc.name
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END AS sports_complex_name,
    f.address AS sports_complex_address,
    sc.description AS sports_complex_description,
    f.operating_hours_start,
    f.operating_hours_end,
    f.amenities,
    COALESCE(sc.general_services, '{}') AS general_services,
    COALESCE(f.allowed_durations, ARRAY[60,90,120]::integer[]) AS allowed_durations,
    f.created_at,
    f.promotion_only
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$function$;