-- Fix facilities INSERT policy to allow creation during registration
DROP POLICY IF EXISTS "Only facility owners can create facilities" ON public.facilities;

CREATE POLICY "Allow facility creation during registration and for facility owners" 
ON public.facilities 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND (
    -- Allow if user has facility_owner role
    has_role('facility_owner'::user_role) OR
    -- Allow if user doesn't have a profile yet (during initial registration)
    NOT EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid()) OR
    -- Allow if user has client role but is upgrading during registration
    has_role('client'::user_role)
  )
);