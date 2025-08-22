-- Fix security issue: Restrict facilities access to authenticated users only
-- This prevents competitors from accessing sensitive business data

-- Drop the existing public policy
DROP POLICY IF EXISTS "Public can view active facilities only" ON public.facilities;

-- Create new policy that requires authentication
CREATE POLICY "Authenticated users can view active facilities" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Update the public function to also require authentication
-- This ensures API access is also restricted
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
  -- Require authentication to access facilities data
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
    AND auth.uid() IS NOT NULL  -- Require authenticated user
  ORDER BY f.created_at DESC;
$function$;