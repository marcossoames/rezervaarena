-- Create a view for public facility information that excludes sensitive owner data
CREATE OR REPLACE VIEW public.public_facilities AS
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

-- Grant public access to the view
GRANT SELECT ON public.public_facilities TO anon;
GRANT SELECT ON public.public_facilities TO authenticated;

-- Remove the current public policy on facilities
DROP POLICY IF EXISTS "Public can view active facilities basic info" ON public.facilities;

-- Create a more restrictive policy - only authenticated users can see facilities with owner info
CREATE POLICY "Authenticated users can view facilities" 
ON public.facilities 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_active = true);

-- Create a policy for anonymous users to access through the view (this is controlled by the view itself)
-- Anonymous access will be through the public_facilities view only