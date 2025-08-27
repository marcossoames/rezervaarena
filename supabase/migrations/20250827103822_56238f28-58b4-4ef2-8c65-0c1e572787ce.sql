-- Update all facility-related RPC functions to include capacity_max

-- Drop and recreate get_facilities_for_authenticated_users
DROP FUNCTION IF EXISTS get_facilities_for_authenticated_users();

CREATE OR REPLACE FUNCTION get_facilities_for_authenticated_users()
RETURNS TABLE (
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
  sports_complex_name text,
  sports_complex_address text,
  phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enhanced data for authenticated users only
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.city || ' area' as area_info,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.amenities,
    f.images,
    -- Sports complex name
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă ' || SPLIT_PART(p.full_name, ' ', 1) || ' - ' || f.city
    END as sports_complex_name,
    -- Full address and contact info for authenticated users
    f.address || ', ' || f.city as sports_complex_address,
    p.phone as phone_number
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
END;
$$;

-- Drop and recreate get_facilities_for_public_browsing_safe
DROP FUNCTION IF EXISTS get_facilities_for_public_browsing_safe();

CREATE OR REPLACE FUNCTION get_facilities_for_public_browsing_safe()
RETURNS TABLE (
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  description text,
  price_per_hour numeric,
  capacity integer,
  capacity_max integer,
  amenities text[],
  images text[],
  sports_complex_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Safe public data without PII exposure
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.amenities,
    f.images,
    -- Safe sports complex name without personal info
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
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;

-- Drop and recreate get_public_facilities
DROP FUNCTION IF EXISTS get_public_facilities();

CREATE OR REPLACE FUNCTION get_public_facilities()
RETURNS TABLE (
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
  amenities text[],
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Full business intelligence data only for admins
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
    f.amenities,
    f.created_at
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role('admin'::user_role)
  ORDER BY f.created_at DESC;
END;
$$;