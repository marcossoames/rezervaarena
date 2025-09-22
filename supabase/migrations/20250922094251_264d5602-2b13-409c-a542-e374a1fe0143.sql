-- Update function for authenticated users to include sports complex name
DROP FUNCTION IF EXISTS public.get_facilities_for_authenticated_users() CASCADE;

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
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;