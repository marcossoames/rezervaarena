-- Drop and recreate get_facilities_for_public_browsing_safe to fix image display
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing_safe();

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  area_info text,
  description text,
  price_range text,
  capacity_range text,
  amenities text[],
  images text[],
  main_image_url text,
  sports_complex_name text,
  sports_complex_address text,
  sports_complex_description text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Public browsing data - minimal info for facility discovery
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show general area without exact address for security
    f.city || ' area' as area_info,
    -- Show limited description for public browsing
    LEFT(f.description, 200) as description,
    -- Show price range instead of exact price
    CASE 
      WHEN f.price_per_hour < 50 THEN 'Sub 50 RON/oră'
      WHEN f.price_per_hour < 100 THEN '50-100 RON/oră'
      WHEN f.price_per_hour < 150 THEN '100-150 RON/oră'
      ELSE 'Peste 150 RON/oră'
    END as price_range,
    -- Show capacity range instead of exact numbers
    CASE 
      WHEN f.capacity < 10 THEN 'Până la 10 persoane'
      WHEN f.capacity < 20 THEN '10-20 persoane'
      ELSE 'Peste 20 persoane'
    END as capacity_range,
    -- Show amenities to highlight facility features
    f.amenities,
    -- Show images directly from facilities table
    f.images,
    f.main_image_url,
    -- Sports complex information
    COALESCE(sc.name, 'Baza Sportivă') as sports_complex_name,
    COALESCE(sc.address || ', ' || sc.city, f.city) as sports_complex_address,
    sc.description as sports_complex_description
  FROM facilities f
  LEFT JOIN sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;