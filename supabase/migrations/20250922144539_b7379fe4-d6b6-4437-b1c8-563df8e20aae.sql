-- Drop and recreate functions to add operating hours

DROP FUNCTION IF EXISTS public.get_facilities_for_authenticated_users();
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();
DROP FUNCTION IF EXISTS public.get_owner_facility_details();

-- Recreate get_facilities_for_authenticated_users with operating hours
CREATE OR REPLACE FUNCTION public.get_facilities_for_authenticated_users()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, address text, description text, price_per_hour numeric, capacity integer, capacity_max integer, images text[], main_image_url text, sports_complex_name text, sports_complex_address text, operating_hours_start time without time zone, operating_hours_end time without time zone, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only for authenticated users
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
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END AS sports_complex_name,
    f.address AS sports_complex_address,
    f.operating_hours_start,
    f.operating_hours_end,
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$function$;

-- Recreate get_facilities_for_public_browsing_safe with operating hours
CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, address text, description text, price_per_hour numeric, capacity integer, capacity_max integer, images text[], main_image_url text, sports_complex_name text, sports_complex_address text, operating_hours_start time without time zone, operating_hours_end time without time zone, created_at timestamp with time zone)
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
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END AS sports_complex_name,
    f.address AS sports_complex_address,
    f.operating_hours_start,
    f.operating_hours_end,
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$function$;

-- Recreate get_owner_facility_details with operating hours
CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
 RETURNS TABLE(id uuid, owner_id uuid, name text, description text, facility_type facility_type, full_address text, city text, exact_price_per_hour numeric, exact_capacity integer, exact_capacity_max integer, amenities text[], images text[], main_image_url text, operating_hours_start time without time zone, operating_hours_end time without time zone, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
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
    f.capacity_max as exact_capacity_max,
    f.amenities,
    f.images,
    f.main_image_url,
    f.operating_hours_start,
    f.operating_hours_end,
    f.is_active,
    f.created_at,
    f.updated_at
  FROM facilities f
  WHERE f.owner_id = auth.uid()
  ORDER BY f.created_at DESC;
END;
$function$;