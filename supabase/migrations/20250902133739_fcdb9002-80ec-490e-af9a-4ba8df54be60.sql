-- Fix anonymous access warnings by restricting policies to authenticated users only

-- Fix articles policies - restrict anonymous access for published articles
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;
CREATE POLICY "Authenticated users can view published articles" 
ON public.articles 
FOR SELECT 
TO authenticated
USING (is_published = true);

-- Fix facility_images - restrict public access to authenticated users
DROP POLICY IF EXISTS "Public can view facility images for active facilities" ON public.facility_images;
CREATE POLICY "Authenticated users can view facility images" 
ON public.facility_images 
FOR SELECT 
TO authenticated
USING (EXISTS ( 
  SELECT 1
  FROM facilities f
  WHERE f.id = facility_images.facility_id 
    AND f.is_active = true
));

-- Fix facility_services - restrict public access
DROP POLICY IF EXISTS "All users can view facility services for active facilities" ON public.facility_services;
CREATE POLICY "Authenticated users can view facility services" 
ON public.facility_services 
FOR SELECT 
TO authenticated
USING (EXISTS ( 
  SELECT 1
  FROM facilities f
  WHERE f.id = facility_services.facility_id 
    AND f.is_active = true
));

-- Fix blocked_dates - ensure only authenticated users can view
DROP POLICY IF EXISTS "Users can view blocked dates only when booking specific facilit" ON public.blocked_dates;
CREATE POLICY "Authenticated users can view blocked dates for booking" 
ON public.blocked_dates 
FOR SELECT 
TO authenticated
USING (
  (auth.uid() IS NOT NULL) 
  AND (EXISTS ( 
    SELECT 1
    FROM facilities f
    WHERE f.id = blocked_dates.facility_id 
      AND f.is_active = true
  ))
);

-- Add explicit TO authenticated for all remaining policies to prevent anonymous access
-- This ensures no table accidentally allows anonymous access

-- Ensure profiles denies anonymous access explicitly
DROP POLICY IF EXISTS "Deny all anonymous access to profiles" ON public.profiles;
CREATE POLICY "Explicit authenticated access only for profiles" 
ON public.profiles 
FOR ALL 
TO authenticated
USING ((auth.uid() IS NOT NULL) AND ((auth.uid() = user_id) OR has_role('admin'::user_role)));

-- Update storage policies to be more restrictive
-- Remove any potential anonymous access to storage