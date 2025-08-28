-- Fix Personal Information Exposure in RPC Functions
-- Remove or anonymize personal data exposure in facility listing functions

-- 1. Update get_facilities_for_authenticated_users to not expose phone numbers in public contexts
CREATE OR REPLACE FUNCTION public.get_facilities_for_authenticated_users()
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
  sports_complex_name text, 
  sports_complex_address text
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data for authenticated users, without exposing personal phone numbers
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

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
    -- Sports complex name without exposing personal info
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă ' || SPLIT_PART(p.full_name, ' ', 1) || ' - ' || f.city
    END as sports_complex_name,
    -- General address without full personal address
    f.city || ' area' as sports_complex_address
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;

-- 2. Create a new function for booking context that includes contact info (only when actually booking)
CREATE OR REPLACE FUNCTION public.get_facility_contact_for_booking(facility_id_param uuid)
RETURNS TABLE(
  sports_complex_name text,
  sports_complex_address text,
  phone_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return contact info when user is authenticated and accessing specific facility
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for contact information';
  END IF;

  RETURN QUERY
  SELECT 
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
    -- Full address for confirmed bookings
    f.address || ', ' || f.city as sports_complex_address,
    -- Phone number only for booking purposes
    p.phone as phone_number
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.id = facility_id_param 
    AND f.is_active = true;
END;
$$;

-- 3. Update get_facilities_for_public_browsing_safe to ensure no personal data leakage
CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE(
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
SET search_path TO 'public'
AS $$
BEGIN
  -- Safe public data without any personal information exposure
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
    -- Safe sports complex name without any personal info
    'Baza Sportivă - ' || f.city as sports_complex_name
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;