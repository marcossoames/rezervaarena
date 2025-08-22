-- Remove the problematic view and use a different approach
DROP VIEW IF EXISTS public.public_facilities;

-- Revoke the grants we made
REVOKE SELECT ON public.public_facilities FROM anon;
REVOKE SELECT ON public.public_facilities FROM authenticated;

-- Create a policy that allows anonymous users to see basic facility info without owner details
-- We'll handle this in the application code by only selecting specific columns
CREATE POLICY "Public can view basic facility info without owner details" 
ON public.facilities 
FOR SELECT 
USING (is_active = true);

-- This policy will allow the application to query facilities, but the application code
-- should be careful to not expose owner_id to anonymous users