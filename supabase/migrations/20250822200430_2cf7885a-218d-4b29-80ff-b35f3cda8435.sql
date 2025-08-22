-- Fix RLS policy for facility registration
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can insert facilities when registering as facility owner" ON public.facilities;

-- Create a more permissive policy for facility registration
CREATE POLICY "Users can insert facilities when registering as facility owner" 
ON public.facilities 
FOR INSERT 
WITH CHECK (
  auth.uid() = owner_id AND (
    has_role('facility_owner'::user_role) OR 
    has_role('client'::user_role) OR
    -- Allow during registration when profile might not exist yet
    NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid())
  )
);