-- ============================================================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- ============================================================================

-- 1. Create new app_role enum for the secure role system
CREATE TYPE public.app_role AS ENUM ('admin', 'facility_owner', 'client');

-- 2. Create secure user_roles table (separate from profiles to prevent privilege escalation)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Create security definer function for role checks (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role_v2(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 4. Migrate existing roles from profiles.role to user_roles table
INSERT INTO public.user_roles (user_id, role, created_at)
SELECT 
  user_id,
  CASE 
    WHEN role = 'admin'::user_role THEN 'admin'::app_role
    WHEN role = 'facility_owner'::user_role THEN 'facility_owner'::app_role
    ELSE 'client'::app_role
  END,
  created_at
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. Add RLS policies to user_roles table
-- Only admins can view all roles
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Only admins can insert/update/delete roles
CREATE POLICY "Only admins can manage user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role_v2(auth.uid(), 'admin'::app_role));

-- 6. Update handle_new_user trigger to use new role system
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path TO 'public'
AS $$
DECLARE
  facilities_json jsonb;
  facility jsonb;
  facility_type_text text;
  amenities_text_array text[];
  general_services_array text[];
  city_text text;
  address_text text;
  price_numeric numeric;
  capacity_int integer;
  capacity_max_int integer;
  operating_hours_start_text text;
  operating_hours_end_text text;
  business_name_text text;
  business_description_text text;
  allowed_durations_array integer[];
  user_role app_role;
BEGIN
  -- Determine user role
  IF (NEW.raw_user_meta_data ->> 'role') = 'facility_owner' OR NEW.raw_user_meta_data ->> 'business_name' IS NOT NULL THEN
    user_role := 'facility_owner'::app_role;
  ELSE
    user_role := 'client'::app_role;
  END IF;

  -- Create profile (without role column)
  INSERT INTO public.profiles (user_id, email, full_name, phone, user_type_comment)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
      'Telefon necompletat'
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'user_type_comment', ''),
      CASE 
        WHEN NEW.raw_user_meta_data ->> 'business_name' IS NOT NULL 
        THEN CONCAT(NEW.raw_user_meta_data ->> 'business_name', ' - Proprietar bază sportivă')
        ELSE 'Client obișnuit'
      END
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    user_type_comment = EXCLUDED.user_type_comment;

  -- Create role in user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Create sports complex if business data is provided
  business_name_text := NULLIF(NEW.raw_user_meta_data ->> 'business_name', '');
  business_description_text := NULLIF(NEW.raw_user_meta_data ->> 'business_description', '');
  city_text := NULLIF(NEW.raw_user_meta_data ->> 'city', '');
  address_text := NULLIF(NEW.raw_user_meta_data ->> 'address', '');
  
  IF NEW.raw_user_meta_data ? 'general_services' AND 
     NEW.raw_user_meta_data ->> 'general_services' IS NOT NULL THEN
    general_services_array := ARRAY(
      SELECT jsonb_array_elements_text(NEW.raw_user_meta_data -> 'general_services')
    );
  ELSE
    general_services_array := '{}';
  END IF;
  
  IF business_name_text IS NOT NULL THEN
    INSERT INTO public.sports_complexes (
      owner_id,
      name,
      description,
      address,
      city,
      general_services
    ) VALUES (
      NEW.id,
      business_name_text,
      business_description_text,
      address_text,
      city_text,
      general_services_array
    ) ON CONFLICT (owner_id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      general_services = EXCLUDED.general_services;
  END IF;
  
  -- Create facilities from metadata if provided
  facilities_json := NEW.raw_user_meta_data -> 'facilities';
  IF facilities_json IS NOT NULL AND jsonb_typeof(facilities_json) = 'array' THEN
    FOR facility IN SELECT jsonb_array_elements(facilities_json) LOOP
      BEGIN
        facility_type_text := NULLIF(facility->>'facilityType', '');
        city_text := COALESCE(NULLIF(facility->>'city', ''), NULLIF(NEW.raw_user_meta_data->>'city', ''));
        address_text := COALESCE(NULLIF(facility->>'address', ''), NULLIF(NEW.raw_user_meta_data->>'address', ''));
        price_numeric := NULLIF(facility->>'pricePerHour', '')::numeric;
        capacity_int := NULLIF(facility->>'capacity', '')::integer;
        capacity_max_int := NULLIF(facility->>'capacityMax', '')::integer;
        operating_hours_start_text := COALESCE(NULLIF(facility->>'operatingHoursStart', ''), '08:00');
        operating_hours_end_text := COALESCE(NULLIF(facility->>'operatingHoursEnd', ''), '22:00');
        
        amenities_text_array := (
          SELECT ARRAY(SELECT jsonb_array_elements_text(facility->'amenities'))
        );
        
        IF facility ? 'allowedDurations' THEN
          allowed_durations_array := ARRAY(SELECT (jsonb_array_elements(facility->'allowedDurations'))::text::integer);
        ELSE
          allowed_durations_array := ARRAY[60,90,120];
        END IF;

        INSERT INTO public.facilities (
          owner_id,
          name,
          description,
          facility_type,
          address,
          city,
          price_per_hour,
          capacity,
          capacity_max,
          amenities,
          operating_hours_start,
          operating_hours_end,
          allowed_durations,
          is_active
        ) VALUES (
          NEW.id,
          COALESCE(NULLIF(facility->>'name',''), 'Facilitate'),
          NULLIF(facility->>'description',''),
          CASE WHEN facility_type_text IS NOT NULL THEN facility_type_text::facility_type ELSE NULL END,
          address_text,
          city_text,
          price_numeric,
          capacity_int,
          capacity_max_int,
          COALESCE(amenities_text_array, '{}'),
          operating_hours_start_text::time,
          operating_hours_end_text::time,
          COALESCE(allowed_durations_array, ARRAY[60,90,120]),
          true
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create facility for user %: %', NEW.id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed in handle_new_user for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 7. Create missing profiles for users with bookings
INSERT INTO public.profiles (user_id, email, full_name, phone, user_type_comment)
SELECT DISTINCT 
  b.client_id,
  COALESCE(au.email, 'email_missing@example.com'),
  COALESCE(au.raw_user_meta_data->>'full_name', 'Nume necunoscut'),
  COALESCE(au.raw_user_meta_data->>'phone', 'Telefon necunoscut'),
  'Profile auto-created for existing booking'
FROM public.bookings b
LEFT JOIN auth.users au ON au.id = b.client_id
LEFT JOIN public.profiles p ON p.user_id = b.client_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Create client roles for these users
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT b.client_id, 'client'::app_role
FROM public.bookings b
LEFT JOIN public.user_roles ur ON ur.user_id = b.client_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Fix database functions with missing search_path
-- Update promote_user_to_admin_secure
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to promote users
  IF NOT has_role_v2(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot promote yourself';
  END IF;
  
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Add admin role
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_user_id, 'admin'::app_role, auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'promote_to_admin',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN FOUND;
END;
$$;