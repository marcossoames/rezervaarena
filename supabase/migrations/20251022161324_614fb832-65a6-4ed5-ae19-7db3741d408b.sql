-- Fix: Return exact price and capacity values instead of ranges
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  area_info text,
  description text,
  price_per_hour numeric,
  capacity integer,
  capacity_max integer,
  amenities text[],
  images text[],
  main_image_url text,
  sports_complex_name text,
  sports_complex_address text,
  sports_complex_description text,
  general_services text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.city || ' area' as area_info,
    LEFT(f.description, 200) as description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.amenities,
    f.images,
    f.main_image_url,
    COALESCE(sc.name, 'Baza Sportivă') as sports_complex_name,
    COALESCE(sc.address, f.city) as sports_complex_address,
    sc.description as sports_complex_description,
    COALESCE(sc.general_services, '{}') as general_services
  FROM facilities f
  LEFT JOIN sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;