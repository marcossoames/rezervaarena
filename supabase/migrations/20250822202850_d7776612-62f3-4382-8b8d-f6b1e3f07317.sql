-- Allow facility creation with client role and update existing policy
DROP POLICY IF EXISTS "Allow facility creation during registration and for facility ow" ON public.facilities;

-- Create a more permissive policy for facility creation
CREATE POLICY "Allow authenticated users to create facilities"
ON public.facilities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Add a comment field to profiles to identify facility owners vs regular clients
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type_comment TEXT;

-- Update profiles to have a comment for admin identification
UPDATE public.profiles 
SET user_type_comment = CASE 
  WHEN role = 'facility_owner' THEN 'Proprietar bază sportivă'
  WHEN role = 'admin' THEN 'Administrator'
  ELSE 'Client obișnuit'
END;