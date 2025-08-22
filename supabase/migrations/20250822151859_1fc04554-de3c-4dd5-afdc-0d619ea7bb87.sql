-- Fix client access function by dropping and recreating
-- This addresses the return type change issue

-- Drop the existing function completely
DROP FUNCTION IF EXISTS public.get_facilities_for_booking();

-- Recreate with enhanced security and minimal data exposure
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  -- More restrictive address info
  area_info text,
  description text, 
  price_per_hour numeric, 
  capacity integer, 
  images text[], 
  amenities text[]
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Minimal data exposure for clients to prevent competitive intelligence
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show only general area instead of exact address
    f.city || ' area' as area_info,
    -- Limit description to prevent sensitive info leakage
    CASE 
      WHEN LENGTH(f.description) > 100 THEN SUBSTRING(f.description FROM 1 FOR 100) || '...'
      ELSE f.description
    END as description,
    f.price_per_hour,
    f.capacity,
    f.images,
    f.amenities
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role('client'::user_role)
  ORDER BY f.created_at DESC;
$function$;