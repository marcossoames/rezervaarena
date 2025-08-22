-- CRITICAL SECURITY FIXES

-- 1. Drop the insecure promote_user_to_admin function
DROP FUNCTION IF EXISTS public.promote_user_to_admin(text);

-- 2. Create secure admin promotion function (admin-only)
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admins to promote users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  UPDATE public.profiles 
  SET role = 'admin'::user_role 
  WHERE user_id = _user_id;
  
  RETURN FOUND;
END;
$$;

-- 3. Create safe self-upgrade function for facility owners
CREATE OR REPLACE FUNCTION public.promote_self_to_facility_owner()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'facility_owner'::user_role 
  WHERE user_id = auth.uid() 
    AND role = 'client'::user_role;
  
  RETURN FOUND;
END;
$$;

-- 4. Create trigger for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'client'::user_role
  );
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Add unique constraints to profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);

-- 6. Drop overly broad RLS policies and create secure ones
DROP POLICY IF EXISTS "Public can view basic facility info without owner details" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can view facilities" ON public.facilities;
DROP POLICY IF EXISTS "Auth users can view full facility details" ON public.facilities;

-- Replace with proper authenticated access
CREATE POLICY "Authenticated users can view active facilities" 
ON public.facilities 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- 7. Replace ALL policy with specific ones for facilities
DROP POLICY IF EXISTS "Facility owners can manage their facilities" ON public.facilities;

CREATE POLICY "Facility owners can insert their facilities" 
ON public.facilities 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Facility owners can update their facilities" 
ON public.facilities 
FOR UPDATE 
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Facility owners can delete their facilities" 
ON public.facilities 
FOR DELETE 
TO authenticated
USING (auth.uid() = owner_id);

-- 8. Secure profiles policies
DROP POLICY IF EXISTS "Users can update only their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile (no role change)" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update any profile including roles" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (has_role('admin'::user_role));

-- Secure profile insertion
DROP POLICY IF EXISTS "Users can insert only their own profile" ON public.profiles;

CREATE POLICY "Users can insert only their own profile as client" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'client'::user_role);

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_self_to_facility_owner() TO authenticated;