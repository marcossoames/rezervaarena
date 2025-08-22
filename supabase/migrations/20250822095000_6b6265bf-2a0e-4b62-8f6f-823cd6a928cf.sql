-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Manually create profile for existing user
INSERT INTO public.profiles (user_id, email, full_name, role)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data ->> 'full_name', 'Paul Admin'),
  'admin'::user_role
FROM auth.users
WHERE email = 'soamespaul@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE user_id = auth.users.id
);