-- Drop and recreate the function with sports_complex_description
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();

CREATE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE (
  id uuid,
  name text,
  facility_type text,
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
  created_at timestamptz
) AS $$
  WITH imgs AS (
    SELECT fi.facility_id,
           array_agg(fi.image_url ORDER BY fi.display_order) AS images,
           MAX(CASE WHEN fi.is_main THEN fi.image_url END) AS main_image
    FROM public.facility_images fi
    GROUP BY fi.facility_id
  )
  SELECT
    f.id,
    f.name,
    f.facility_type::text AS facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    COALESCE(imgs.images, ARRAY[]::text[]) AS images,
    COALESCE(f.main_image_url, imgs.main_image) AS main_image_url,
    sc.name AS sports_complex_name,
    sc.address AS sports_complex_address,
    sc.description AS sports_complex_description,
    f.operating_hours_start,
    f.operating_hours_end,
    f.amenities,
    sc.general_services,
    f.created_at
  FROM public.facilities f
  LEFT JOIN imgs ON imgs.facility_id = f.id
  LEFT JOIN public.sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Allow anonymous and authenticated roles to execute this function
GRANT EXECUTE ON FUNCTION public.get_facilities_for_public_browsing_safe() TO anon, authenticated;