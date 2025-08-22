-- Fix granular security: Implement role-based access to facilities data
-- First, clean up existing policies and recreate them properly

-- Drop all existing SELECT policies on facilities
DROP POLICY IF EXISTS "Authenticated users can view active facilities" ON public.facilities;
DROP POLICY IF EXISTS "Public can view active facilities only" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can view their own facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can view all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Clients can view basic facility info for booking" ON public.facilities;

-- Create granular policies based on user roles and needs

-- 1. Facility owners can see their own facilities (full access)
CREATE POLICY "Facility owners can view their own facilities" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (owner_id = auth.uid());

-- 2. Admins can see all facilities (for management) 
CREATE POLICY "Admins can view all facilities for management" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (has_role('admin'::user_role));

-- 3. Clients can only see basic booking information (limited access)
CREATE POLICY "Clients can view basic facility info for booking" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (
  is_active = true 
  AND has_role('client'::user_role)
);

-- Create a client-safe function that only exposes booking-relevant data
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  -- Only partial address for general location
  address_preview text,
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
  -- Only return data if user is authenticated and has client role
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Hide exact address, show only area/neighborhood for privacy
    CASE 
      WHEN LENGTH(f.address) > 20 THEN SUBSTRING(f.address FROM 1 FOR 20) || '...'
      ELSE f.address
    END as address_preview,
    f.description,
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

-- Update the existing function to be admin/owner only
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
  -- Only admins and facility owners can access full facility data
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
    AND (
      has_role('admin'::user_role) 
      OR (has_role('facility_owner'::user_role) AND f.owner_id = auth.uid())
    )
  ORDER BY f.created_at DESC;
$function$;