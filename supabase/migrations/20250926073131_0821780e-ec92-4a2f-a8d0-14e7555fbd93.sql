-- Drop the existing function
DROP FUNCTION IF EXISTS public.get_owner_facility_details();

-- Create a new function to get owner facility details with sports complex info
CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
RETURNS TABLE(
  id UUID,
  owner_id UUID,
  name TEXT,
  description TEXT,
  facility_type facility_type,
  full_address TEXT,
  city TEXT,
  exact_price_per_hour NUMERIC,
  exact_capacity INTEGER,
  exact_capacity_max INTEGER,
  amenities TEXT[], -- Facility-specific amenities
  general_services TEXT[], -- Sports complex general services
  images TEXT[],
  main_image_url TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  operating_hours_start TIME,
  operating_hours_end TIME,
  sports_complex_name TEXT,
  sports_complex_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data for authenticated facility owners
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
    f.amenities, -- Facility-specific amenities
    COALESCE(sc.general_services, '{}') as general_services, -- Sports complex general services
    f.images,
    f.main_image_url,
    f.is_active,
    f.created_at,
    f.updated_at,
    f.operating_hours_start,
    f.operating_hours_end,
    COALESCE(sc.name, 'Baza Sportivă') as sports_complex_name,
    sc.description as sports_complex_description
  FROM facilities f
  LEFT JOIN sports_complexes sc ON sc.owner_id = f.owner_id
  WHERE f.owner_id = auth.uid()
    AND f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;