-- Fix for business facility information exposure - proper function replacement

-- 1. Drop and recreate the client booking function with new secure structure
DROP FUNCTION IF EXISTS public.get_facilities_for_booking();

CREATE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  area_info text, 
  description text, 
  base_price_info text,
  capacity_info text,
  images text[], 
  amenities text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Secure version that hides sensitive business intelligence
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Hide exact address - only show general area
    f.city || ' area' as area_info,
    -- Limit description to prevent competitive intelligence gathering
    CASE 
      WHEN LENGTH(f.description) > 100 THEN SUBSTRING(f.description FROM 1 FOR 100) || '...'
      ELSE f.description
    END as description,
    -- Hide exact pricing - show generic price info to prevent undercutting
    'Starting from ' || FLOOR(f.price_per_hour)::text || ' RON/hour' as base_price_info,
    -- Hide exact capacity - show generic ranges
    CASE 
      WHEN f.capacity <= 2 THEN 'Small group (1-2 people)'
      WHEN f.capacity <= 6 THEN 'Medium group (3-6 people)'
      WHEN f.capacity <= 12 THEN 'Large group (7-12 people)'
      ELSE 'Extra large group (12+ people)'
    END as capacity_info,
    f.images,
    f.amenities
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role('client'::user_role)
  ORDER BY f.created_at DESC;
$function$;

-- 2. Create public browsing function for anonymous/guest users
CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing()
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  general_area text,
  basic_description text,
  price_range text,
  available_amenities text[],
  has_images boolean,
  rating_display text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Minimal data exposure for public browsing to prevent business intelligence theft
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Very generic area info
    f.city || ' area' as general_area,
    -- Heavily truncated description
    CASE 
      WHEN f.description IS NULL THEN 'Professional sports facility'
      WHEN LENGTH(f.description) > 80 THEN SUBSTRING(f.description FROM 1 FOR 80) || '...'
      ELSE f.description
    END as basic_description,
    -- Price ranges instead of exact pricing to prevent competitive undercutting
    CASE 
      WHEN f.price_per_hour < 100 THEN 'Budget friendly'
      WHEN f.price_per_hour < 200 THEN 'Standard pricing'
      WHEN f.price_per_hour < 300 THEN 'Premium facility'
      ELSE 'Luxury facility'
    END as price_range,
    -- Limited amenities to prevent competitive analysis
    CASE 
      WHEN f.amenities IS NULL THEN ARRAY[]::text[]
      ELSE f.amenities[1:3] -- Only show first 3 amenities
    END as available_amenities,
    -- Boolean indicator instead of exposing actual image URLs
    CASE 
      WHEN f.images IS NULL OR array_length(f.images, 1) IS NULL THEN false
      ELSE true
    END as has_images,
    'Available for booking' as rating_display
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$;

-- 3. Create secure function for facility owners to access their own sensitive data
CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
RETURNS TABLE(
  id uuid,
  owner_id uuid,
  name text,
  description text,
  facility_type facility_type,
  full_address text,
  city text,
  exact_price_per_hour numeric,
  exact_capacity integer,
  amenities text[],
  images text[],
  main_image_url text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Full sensitive data only for facility owners viewing their own facilities
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
    f.amenities,
    f.images,
    f.main_image_url,
    f.is_active,
    f.created_at,
    f.updated_at
  FROM facilities f
  WHERE f.owner_id = auth.uid()
    AND has_role('facility_owner'::user_role)
  ORDER BY f.created_at DESC;
$function$;

-- 4. Restrict the public facilities function to admins only (sensitive business data)
CREATE OR REPLACE FUNCTION public.get_public_facilities()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  address text, 
  description text, 
  price_per_hour numeric, 
  capacity integer, 
  images text[], 
  amenities text[], 
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Full business intelligence data only for admins
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.images,
    f.amenities,
    f.created_at
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role('admin'::user_role)
  ORDER BY f.created_at DESC;
$function$;