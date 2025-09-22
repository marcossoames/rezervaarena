-- Update get_facility_for_payment_secure to include amenities
DROP FUNCTION IF EXISTS public.get_facility_for_payment_secure(uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.get_facility_for_payment_secure(facility_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  price_per_hour numeric,
  capacity integer,
  amenities text[],
  images text[],
  owner_id uuid,
  sports_complex_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return data for authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.price_per_hour,
    f.capacity,
    f.amenities,
    f.images,
    f.owner_id,
    -- Sports complex name without exposing personal info
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END as sports_complex_name
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.id = facility_id_param 
    AND f.is_active = true;
END;
$$;