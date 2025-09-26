-- Drop and recreate functions to change return type
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();
DROP FUNCTION IF EXISTS public.get_facilities_for_authenticated_users();

-- Recreate get_facilities_for_public_browsing_safe with general_services
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
  operating_hours_start time without time zone,
  operating_hours_end time without time zone,
  amenities text[],
  general_services text[],
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Safe public data for unauthenticated users - no personal/contact information
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
    f.amenities,
    COALESCE(sc.general_services, '{}') AS general_services,
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;

-- Recreate get_facilities_for_authenticated_users with general_services
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
  operating_hours_start time without time zone,
  operating_hours_end time without time zone,
  amenities text[],
  general_services text[],
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    f.amenities,
    COALESCE(sc.general_services, '{}') AS general_services,
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;