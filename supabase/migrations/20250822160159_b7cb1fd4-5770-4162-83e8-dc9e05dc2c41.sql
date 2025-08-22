-- Fix remaining security warnings

-- 1. Remove anonymous access from RLS policies by adding proper authentication requirements

-- Fix admin_audit_logs policy to require authentication
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Only admins can view audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
TO authenticated
USING (has_role('admin'::user_role));

-- Fix bookings policies to require authentication
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can update their pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Facility owners can update bookings for their facilities" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can only view their own bookings" ON public.bookings;

CREATE POLICY "Clients can create bookings" 
ON public.bookings 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their pending bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated
USING ((auth.uid() = client_id) AND (status = 'pending'::booking_status));

CREATE POLICY "Facility owners can update bookings for their facilities" 
ON public.bookings 
FOR UPDATE 
TO authenticated
USING (EXISTS (
  SELECT 1 FROM facilities 
  WHERE facilities.id = bookings.facility_id 
    AND facilities.owner_id = auth.uid()
));

CREATE POLICY "Admins can manage all bookings" 
ON public.bookings 
FOR ALL 
TO authenticated
USING (has_role('admin'::user_role));

CREATE POLICY "Clients can only view their own bookings" 
ON public.bookings 
FOR SELECT 
TO authenticated
USING (
  (client_id = auth.uid()) 
  OR has_role('admin'::user_role) 
  OR (EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.id = bookings.facility_id 
      AND f.owner_id = auth.uid()
  ))
);

-- Fix facilities policies to require authentication
DROP POLICY IF EXISTS "Admins can manage all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can delete their facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can insert their facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can update their facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can view their own facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can view all facilities for management" ON public.facilities;
DROP POLICY IF EXISTS "Facilities access control" ON public.facilities;

CREATE POLICY "Admins can manage all facilities" 
ON public.facilities 
FOR ALL 
TO authenticated
USING (has_role('admin'::user_role));

CREATE POLICY "Facility owners can delete their facilities" 
ON public.facilities 
FOR DELETE 
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Facility owners can insert their facilities" 
ON public.facilities 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Facility owners can update their facilities" 
ON public.facilities 
FOR UPDATE 
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Facility owners can view their own facilities" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (owner_id = auth.uid());

-- Fix profiles policies to require authentication
DROP POLICY IF EXISTS "Users can update their own profile (no role change)" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile including roles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert only their own profile as client" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view their own profile data" ON public.profiles;

CREATE POLICY "Users can update their own profile (no role change)" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (
    SELECT p.role 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Admins can update any profile including roles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role('admin'::user_role));

CREATE POLICY "Users can insert only their own profile as client" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() = user_id) AND (role = 'client'::user_role));

CREATE POLICY "Users can only view their own profile data" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING ((auth.uid() = user_id) OR has_role('admin'::user_role));

-- Fix storage policies to require authentication and remove any anonymous access
DROP POLICY IF EXISTS "Everyone can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility images are publicly viewable" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete images for their facilities" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete their images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update images for their facilities" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update their images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can upload their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete their facility images" ON storage.objects;

-- Create secure authenticated-only storage policies
CREATE POLICY "Authenticated users can view facility images" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can upload their facility images" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'facility-images' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);

CREATE POLICY "Facility owners can update their facility images" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'facility-images' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);

CREATE POLICY "Facility owners can delete their facility images" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'facility-images' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);