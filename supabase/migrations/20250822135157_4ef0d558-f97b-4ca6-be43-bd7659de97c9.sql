-- Drop the problematic view and recreate it without SECURITY DEFINER
DROP VIEW IF EXISTS public.public_facilities;

-- Create the view with SECURITY INVOKER (default) to ensure proper RLS enforcement
CREATE VIEW public.public_facilities 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  facility_type,
  price_per_hour,
  capacity,
  address,
  city,
  description,
  amenities,
  images,
  is_active,
  created_at
FROM public.facilities
WHERE is_active = true;

-- Grant appropriate access to the view
GRANT SELECT ON public.public_facilities TO anon;
GRANT SELECT ON public.public_facilities TO authenticated;