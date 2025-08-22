-- Fix RLS policy for profile creation during registration
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can insert only their own profile as client" ON public.profiles;

-- Create a more permissive policy for profile creation
CREATE POLICY "Users can insert their own profile during registration" 
ON public.profiles 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND (
    role = 'client'::user_role OR 
    role = 'facility_owner'::user_role
  )
);

-- Also update the update policy to be less restrictive about role changes during registration
DROP POLICY IF EXISTS "Users can update their own profile (no role change)" ON public.profiles;

CREATE POLICY "Users can update their own profile with role restrictions" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND (
    -- Allow role change only if current user doesn't have a profile yet (during registration)
    NOT EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid()) OR
    -- Or if keeping the same role
    role = (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  )
);