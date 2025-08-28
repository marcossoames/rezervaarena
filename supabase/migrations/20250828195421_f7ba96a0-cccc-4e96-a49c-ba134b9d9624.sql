-- Fix Customer Personal Information Exposure in Profiles Table
-- This migration ensures that personal data in profiles table is only accessible to authenticated users

-- 1. Drop existing policies that may allow anonymous access
DROP POLICY IF EXISTS "Users can only view their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during registration" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile with role restrictions" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile including roles" ON public.profiles;

-- 2. Create new secure policies with explicit authentication checks

-- SELECT policy: Only authenticated users can view their own profile or admins can view all
CREATE POLICY "Authenticated users can view their own profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    auth.uid() = user_id 
    OR has_role('admin'::user_role)
  )
);

-- INSERT policy: Only authenticated users can create their own profile during registration
CREATE POLICY "Authenticated users can create their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id 
  AND (role = 'client'::user_role OR role = 'facility_owner'::user_role)
);

-- UPDATE policy: Users can only update their own profile (non-role fields)
CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = user_id 
  AND role = get_current_user_role()
);

-- UPDATE policy: Only admins can update any profile including roles
CREATE POLICY "Admins can update any profile including roles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND has_role('admin'::user_role)
)
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_role('admin'::user_role)
);

-- 3. Ensure no DELETE access to profiles (accounts should be deleted via functions)
-- No DELETE policy = no one can delete profiles directly

-- 4. Add explicit denial for anonymous users (extra security layer)
CREATE POLICY "Deny all anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);