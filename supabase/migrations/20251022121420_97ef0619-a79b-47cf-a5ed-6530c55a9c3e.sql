-- Fix get_promotion_facility_details to return address from sports_complexes instead of facilities
CREATE OR REPLACE FUNCTION public.get_promotion_facility_details(facility_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  description text,
  facility_type facility_type,
  address text,
  city text,
  price_per_hour numeric,
  capacity integer,
  capacity_max integer,
  amenities text[],
  images text[],
  main_image_url text,
  operating_hours_start time without time zone,
  operating_hours_end time without time zone,
  owner_phone text,
  sports_complex_name text,
  general_services text[]
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
    f.description,
    f.facility_type,
    -- Return address from sports_complexes if available, otherwise from facilities
    COALESCE(sc.address, f.address) AS address,
    COALESCE(sc.city, f.city) AS city,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.amenities,
    f.images,
    f.main_image_url,
    f.operating_hours_start,
    f.operating_hours_end,
    p.phone AS owner_phone,
    CASE 
      WHEN sc.name IS NOT NULL THEN sc.name
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || COALESCE(sc.city, f.city)
    END AS sports_complex_name,
    COALESCE(sc.general_services, '{}') AS general_services
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.id = facility_id_param
    AND f.is_active = true
    AND f.promotion_only = true;
END;
$function$;