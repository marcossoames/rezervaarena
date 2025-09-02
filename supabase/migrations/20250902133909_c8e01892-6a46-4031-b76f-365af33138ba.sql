-- Fix remaining RLS policies to explicitly require authentication
-- Check and update policies without conflicts

-- Fix facility_images public viewing policy (check if it exists first)
DROP POLICY IF EXISTS "Public can view facility images for active facilities" ON public.facility_images;
CREATE POLICY "Authenticated users can view facility images for active facilities" 
ON public.facility_images 
FOR SELECT 
TO authenticated
USING (EXISTS ( SELECT 1
   FROM facilities f
  WHERE ((f.id = facility_images.facility_id) AND (f.is_active = true))));

-- Fix facility_services public viewing policy
DROP POLICY IF EXISTS "All users can view facility services for active facilities" ON public.facility_services;
CREATE POLICY "Authenticated users can view facility services for active facilities" 
ON public.facility_services 
FOR SELECT 
TO authenticated
USING (EXISTS ( SELECT 1
   FROM facilities f
  WHERE ((f.id = facility_services.facility_id) AND (f.is_active = true))));

-- Fix blocked_dates policy name (it was misleading)
DROP POLICY IF EXISTS "Users can view blocked dates only when booking specific facilit" ON public.blocked_dates;
CREATE POLICY "Authenticated users can view blocked dates for booking" 
ON public.blocked_dates 
FOR SELECT 
TO authenticated
USING ((auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM facilities f
  WHERE ((f.id = blocked_dates.facility_id) AND (f.is_active = true)))));

-- Update storage policies to be more explicit
DROP POLICY IF EXISTS "Public can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Public read facility images" ON storage.objects;

CREATE POLICY "Authenticated users can view facility images" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'facility-images');