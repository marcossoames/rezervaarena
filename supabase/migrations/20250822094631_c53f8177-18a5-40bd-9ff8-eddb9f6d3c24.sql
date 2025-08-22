-- Create admin user through auth and set admin role
-- First, we need to ensure we can update the profile role to admin after user creation

-- Insert a manual admin user (this will need to be done through Supabase Auth signup first)
-- Then we'll update the role to admin

-- Function to promote a user to admin (can only be called by existing admins or system)
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.profiles 
  SET role = 'admin'::user_role 
  WHERE email = user_email;
$$;

-- For now, let's manually set the admin role for the specific email
-- This will be executed after the user signs up
UPDATE public.profiles 
SET role = 'admin'::user_role 
WHERE email = 'soamespaul@gmail.com';

-- If the user doesn't exist yet, we'll insert a placeholder that will be updated when they sign up
INSERT INTO public.profiles (user_id, email, full_name, role)
SELECT 
  gen_random_uuid(),
  'soamespaul@gmail.com',
  'Paul Admin',
  'admin'::user_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE email = 'soamespaul@gmail.com'
);