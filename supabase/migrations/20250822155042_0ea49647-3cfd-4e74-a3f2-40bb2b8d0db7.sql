-- Fix facilities access policy to allow RPC functions while blocking direct client access

-- Remove the overly restrictive policy
DROP POLICY IF EXISTS "Clients can only access facilities through RPC" ON public.facilities;

-- Create a proper policy that allows RPC access but blocks direct client queries
-- This policy allows access for admins, facility owners, and SECURITY DEFINER functions
CREATE POLICY "Facilities access control" 
ON public.facilities 
FOR SELECT 
USING (
  -- Allow admins to see everything
  has_role('admin'::user_role) 
  -- Allow facility owners to see their own facilities
  OR (has_role('facility_owner'::user_role) AND owner_id = auth.uid())
  -- Allow access from SECURITY DEFINER functions (RPC calls)
  -- The key insight: SECURITY DEFINER functions execute with elevated privileges
  -- This condition will be true when called from get_facilities_for_booking RPC
  OR current_setting('role', true) = 'supabase_admin'
);

-- Ensure the RPC function has the correct security context
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
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
  -- This function executes with supabase_admin role, bypassing RLS
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show only general area instead of exact address for security
    f.city || ' area' as area_info,
    -- Limit description length to prevent sensitive info leakage
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
    -- Additional security: only show to authenticated users
    AND auth.uid() IS NOT NULL
    AND has_role('client'::user_role)
  ORDER BY f.created_at DESC;
$function$;