-- Fix RLS policy to allow facility registration during signup
-- Update the facility insert policy to allow clients to register as facility owners
DROP POLICY IF EXISTS "Facility owners can insert their facilities" ON public.facilities;

CREATE POLICY "Users can insert facilities when registering as facility owner" 
ON public.facilities 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND 
  (
    has_role('facility_owner'::user_role) OR 
    -- Allow during registration process when profile doesn't exist yet
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Add a table for facility services (parking, bar, etc.)
CREATE TABLE IF NOT EXISTS public.facility_services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  description text,
  price numeric(10,2),
  is_included boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on facility_services
ALTER TABLE public.facility_services ENABLE ROW LEVEL SECURITY;

-- Create policies for facility_services
CREATE POLICY "Facility owners can manage their facility services" 
ON public.facility_services 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.id = facility_services.facility_id 
    AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all facility services" 
ON public.facility_services 
FOR ALL 
USING (has_role('admin'::user_role));

CREATE POLICY "Public can view facility services" 
ON public.facility_services 
FOR SELECT 
USING (true);

-- Add a table for facility images with better organization
CREATE TABLE IF NOT EXISTS public.facility_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_main boolean DEFAULT false,
  display_order integer DEFAULT 0,
  caption text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on facility_images
ALTER TABLE public.facility_images ENABLE ROW LEVEL SECURITY;

-- Create policies for facility_images
CREATE POLICY "Facility owners can manage their facility images" 
ON public.facility_images 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.id = facility_images.facility_id 
    AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all facility images" 
ON public.facility_images 
FOR ALL 
USING (has_role('admin'::user_role));

CREATE POLICY "Public can view facility images" 
ON public.facility_images 
FOR SELECT 
USING (true);