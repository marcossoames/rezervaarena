
-- Insert admin user into auth.users table
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'soamespaul@gmail.com',
  crypt('Bunicuion3!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Administrator"}',
  false,
  'authenticated'
);

-- Insert profile for the admin user with admin role
INSERT INTO public.profiles (
  user_id,
  email,
  full_name,
  role
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'soamespaul@gmail.com'),
  'soamespaul@gmail.com',
  'Administrator',
  'admin'
);
