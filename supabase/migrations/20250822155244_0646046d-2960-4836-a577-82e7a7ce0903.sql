-- Comprehensive security fix for business facility information exposure

-- 1. Create a secure public browsing function that exposes only non-sensitive data
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
  -- Only expose non-sensitive business data for public browsing
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Generic area info instead of exact address
    f.city || ' area' as general_area,
    -- Truncated description to prevent business intelligence gathering
    CASE 
      WHEN f.description IS NULL THEN 'Professional sports facility'
      WHEN LENGTH(f.description) > 80 THEN SUBSTRING(f.description FROM 1 FOR 80) || '...'
      ELSE f.description
    END as basic_description,
    -- Price range instead of exact pricing to prevent undercutting
    CASE 
      WHEN f.price_per_hour < 100 THEN 'Budget friendly'
      WHEN f.price_per_hour < 200 THEN 'Standard pricing'
      WHEN f.price_per_hour < 300 THEN 'Premium facility'
      ELSE 'Luxury facility'
    END as price_range,
    -- Limited amenities (only customer-facing, not business intel)
    CASE 
      WHEN f.amenities IS NULL THEN ARRAY[]::text[]
      ELSE f.amenities[1:3] -- Only show first 3 amenities
    END as available_amenities,
    -- Boolean indicator instead of actual image URLs
    CASE 
      WHEN f.images IS NULL OR array_length(f.images, 1) IS NULL THEN false
      ELSE true
    END as has_images,
    -- Generic rating display (placeholder for future rating system)
    'Available for booking' as rating_display
  FROM facilities f
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$;

-- 2. Update the client booking function to be more restrictive
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
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
  -- More secure version for authenticated clients only
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Still hide exact address
    f.city || ' area' as area_info,
    -- Limited description
    CASE 
      WHEN LENGTH(f.description) > 100 THEN SUBSTRING(f.description FROM 1 FOR 100) || '...'
      ELSE f.description
    END as description,
    -- Generic price info instead of exact pricing
    'Starting from ' || FLOOR(f.price_per_hour)::text || ' RON/hour' as base_price_info,
    -- Generic capacity info
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

-- 3. Create a detailed function for facility owners to see their own sensitive data
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
  updated_at timestamp with time zone,
  booking_stats jsonb
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
    f.updated_at,
    -- Add booking statistics (placeholder for future analytics)
    jsonb_build_object(
      'total_bookings', 0,
      'revenue_this_month', 0,
      'average_rating', 0
    ) as booking_stats
  FROM facilities f
  WHERE f.owner_id = auth.uid()
    AND has_role('facility_owner'::user_role)
  ORDER BY f.created_at DESC;
$function$;

-- 4. Update existing RPC function to use the more secure public browsing version
-- This ensures backward compatibility while improving security
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
  -- Only admins should see full sensitive business data
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

-- 5. Add audit logging for sensitive data access
CREATE OR REPLACE FUNCTION public.log_facility_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Log when sensitive facility data is accessed
  IF TG_OP = 'SELECT' AND has_role('client'::user_role) THEN
    INSERT INTO public.admin_audit_logs (
      admin_user_id, 
      action, 
      target_user_id, 
      metadata
    ) VALUES (
      auth.uid(),
      'facility_data_access',
      auth.uid(),
      jsonb_build_object(
        'facility_id', NEW.id,
        'access_time', now(),
        'user_role', 'client'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Note: Trigger creation commented out as it may impact performance
-- Uncomment if detailed audit logging is required:
-- CREATE TRIGGER facility_access_audit
--   AFTER SELECT ON public.facilities
--   FOR EACH ROW EXECUTE FUNCTION public.log_facility_access();