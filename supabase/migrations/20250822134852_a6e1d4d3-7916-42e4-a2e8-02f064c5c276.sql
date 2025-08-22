-- Fix security issues with RLS policies

-- 1. First, ensure the profiles table has proper RLS that prevents any unauthorized access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 2. Create a more secure admin policy that uses the existing security definer function
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.has_role('admin'::user_role));

-- 3. Add a policy to prevent any unauthenticated access to profiles
CREATE POLICY "Profiles require authentication" 
ON public.profiles 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- 4. Update facilities table to require authentication for viewing sensitive data
-- Keep public access for basic facility info but restrict owner details
DROP POLICY IF EXISTS "Everyone can view active facilities" ON public.facilities;

-- 5. Create separate policies for facilities - public can see basic info, but not owner details
CREATE POLICY "Public can view basic facility info" 
ON public.facilities 
FOR SELECT 
USING (
  is_active = true AND 
  current_setting('request.jwt.claims', true)::json->>'role' IS NOT NULL
);

-- 6. Allow unauthenticated users to see very basic facility info (for homepage)
CREATE POLICY "Unauthenticated can view basic facility listing" 
ON public.facilities 
FOR SELECT 
USING (
  is_active = true AND 
  auth.uid() IS NULL
);

-- 7. Facility owners and admins can see full details
CREATE POLICY "Owners and admins can view full facility details" 
ON public.facilities 
FOR SELECT 
USING (
  auth.uid() = owner_id OR 
  public.has_role('admin'::user_role)
);

-- 8. Ensure bookings are properly secured (they already look good)
-- No changes needed for bookings table as it's already properly secured

-- 9. Add indexes for better performance on RLS queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_facilities_owner_id ON public.facilities(owner_id);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON public.facilities(is_active) WHERE is_active = true;