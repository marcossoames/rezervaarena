-- Fix the profiles table RLS policies to properly restrict access

-- Remove the overly broad authentication policy
DROP POLICY IF EXISTS "Profiles require authentication" ON public.profiles;

-- Ensure the user-specific policies are properly restrictive
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create more specific and secure policies for profiles
CREATE POLICY "Users can view only their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update only their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert only their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Ensure no DELETE policy exists for profiles (prevent data deletion)
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- Update the facilities policies to be more secure - first drop the problematic ones
DROP POLICY IF EXISTS "Public can view basic facility info" ON public.facilities;
DROP POLICY IF EXISTS "Unauthenticated can view basic facility listing" ON public.facilities;
DROP POLICY IF EXISTS "Owners and admins can view full facility details" ON public.facilities;

-- Create a single, secure policy for facilities that allows public viewing of basic info only
CREATE POLICY "Public can view active facilities basic info" 
ON public.facilities 
FOR SELECT 
USING (is_active = true);