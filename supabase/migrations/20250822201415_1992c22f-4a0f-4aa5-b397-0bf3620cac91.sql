-- CRITICAL SECURITY FIXES

-- 1. Add unique constraint to profiles.user_id to prevent duplicate profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- 2. Create trigger for automatic profile creation on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix facilities INSERT RLS policy - only allow facility_owner role or during initial registration
DROP POLICY IF EXISTS "Users can insert facilities when registering as facility owner" ON public.facilities;

CREATE POLICY "Only facility owners can create facilities" 
ON public.facilities 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND 
  has_role('facility_owner'::user_role)
);

-- 4. Make facility-images storage bucket private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'facility-images';

-- 5. Fix anonymous access policies - restrict to authenticated users only
DROP POLICY IF EXISTS "Public can view facility images" ON public.facility_images;
DROP POLICY IF EXISTS "Public can view facility services" ON public.facility_services;

CREATE POLICY "Authenticated users can view facility images" 
ON public.facility_images 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can view facility services" 
ON public.facility_services 
FOR SELECT 
TO authenticated
USING (true);

-- 6. Create storage policies for private facility-images bucket
CREATE POLICY "Facility owners can upload images" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Facility owners can update their images" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Facility owners can delete their images" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Authenticated users can view facility images" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (bucket_id = 'facility-images');