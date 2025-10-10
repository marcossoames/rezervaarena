-- Add RLS policy to allow users to insert their own profile
CREATE POLICY "profiles_users_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);