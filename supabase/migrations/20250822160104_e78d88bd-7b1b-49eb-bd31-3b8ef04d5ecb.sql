-- Fix critical security vulnerabilities

-- 1. Fix RLS recursion risk by improving the profiles update policy
DROP POLICY IF EXISTS "Users can update their own profile (no role change)" ON public.profiles;

CREATE POLICY "Users can update their own profile (no role change)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (
    SELECT p.role 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid()
    LIMIT 1
  )
);

-- 2. Remove the dangerous self-promotion function to prevent privilege escalation
DROP FUNCTION IF EXISTS public.promote_self_to_facility_owner();

-- 3. Create a secure admin-only promotion function instead
CREATE OR REPLACE FUNCTION public.promote_user_to_facility_owner_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to promote users to facility owner
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  -- Update user role from client to facility_owner only
  UPDATE public.profiles 
  SET role = 'facility_owner'::user_role 
  WHERE user_id = _user_id 
    AND role = 'client'::user_role;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'promote_to_facility_owner',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN FOUND;
END;
$function$;

-- 4. Tighten storage policies for facility-images bucket
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Give anon users access to JPG images in folder 1oa8hq5_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1oa8hq5_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users authenticated access to folder 1oa8hq5_2" ON storage.objects;

-- Create secure path-based policies for facility images
CREATE POLICY "Users can view facility images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Facility owners can upload their facility images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Path must start with user's UID
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);

CREATE POLICY "Facility owners can update their facility images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Path must start with user's UID
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);

CREATE POLICY "Facility owners can delete their facility images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND (
    -- Path must start with user's UID
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role('admin'::user_role)
  )
);

-- 5. Improve the profile creation trigger to be more robust
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- More robust profile creation with error handling
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(NEW.email, '@', 1) -- Fallback to email username
    ),
    'client'::user_role
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicate profile creation
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();