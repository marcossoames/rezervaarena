-- Recreate remaining functions that were dropped during enum update

CREATE OR REPLACE FUNCTION public.get_public_facilities()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, address text, description text, price_per_hour numeric, capacity integer, images text[], amenities text[], created_at timestamp with time zone)
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

CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
 RETURNS TABLE(id uuid, owner_id uuid, name text, description text, facility_type facility_type, full_address text, city text, exact_price_per_hour numeric, exact_capacity integer, amenities text[], images text[], main_image_url text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Full sensitive data for facility owners viewing their own facilities
  -- Remove the role check since users start as 'client' role
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
  ORDER BY f.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, description text, price_per_hour numeric, capacity integer, amenities text[], images text[], sports_complex_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Safe public data without PII exposure
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.description,
    f.price_per_hour,
    f.capacity,
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
$function$;