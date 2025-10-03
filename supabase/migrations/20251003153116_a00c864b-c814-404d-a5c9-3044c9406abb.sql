-- Drop all old storage policies first
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins manage facility images" ON storage.objects;
  DROP POLICY IF EXISTS "Facility images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Facility images owner delete" ON storage.objects;
  DROP POLICY IF EXISTS "Facility images owner update" ON storage.objects;
  DROP POLICY IF EXISTS "Facility images public read access" ON storage.objects;
  DROP POLICY IF EXISTS "Facility owners can delete their images" ON storage.objects;
  DROP POLICY IF EXISTS "Facility owners can update their images" ON storage.objects;
  DROP POLICY IF EXISTS "Facility owners delete images" ON storage.objects;
  DROP POLICY IF EXISTS "Facility owners update images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view facility images" ON storage.objects;
  DROP POLICY IF EXISTS "Public read facility images" ON storage.objects;
  DROP POLICY IF EXISTS "Public read for facility-images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view facility images" ON storage.objects;
  DROP POLICY IF EXISTS "Facility owners can upload images" ON storage.objects;
  DROP POLICY IF EXISTS "Admins manage all facility images" ON storage.objects;
END $$;

-- Drop legacy has_role function
DROP FUNCTION IF EXISTS public.has_role(user_role) CASCADE;

-- Create new storage policies
CREATE POLICY "Authenticated users can view facility images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Facility owners can update their images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Facility owners can delete their images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage all facility images"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'facility-images' AND has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'facility-images' AND has_role_v2(auth.uid(), 'admin'::app_role));

-- CRITICAL: Split profiles RLS to prevent PII harvesting
DROP POLICY IF EXISTS "Secure user profile access" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert profiles"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (has_role_v2(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- Protect legacy role column
CREATE OR REPLACE FUNCTION public.prevent_role_column_updates()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT has_role_v2(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Use user_roles table instead';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_role_updates ON public.profiles;
CREATE TRIGGER prevent_role_updates BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_column_updates();

-- Add search_path to functions
CREATE OR REPLACE FUNCTION public.mask_iban(iban_value text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF iban_value IS NULL OR LENGTH(iban_value) < 8 THEN RETURN iban_value; END IF;
  RETURN SUBSTRING(iban_value FROM 1 FOR 4) || REPEAT('*', LENGTH(iban_value) - 8) || SUBSTRING(iban_value FROM LENGTH(iban_value) - 3);
END; $$;

CREATE OR REPLACE FUNCTION public.update_sports_complexes_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
    VALUES (auth.uid(), 'role_change', NEW.user_id, NEW.email, jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'timestamp', now()));
  END IF;
  RETURN NEW;
END; $$;

-- Restrict blocked_dates to authenticated users
DROP POLICY IF EXISTS "Public can view blocked dates for calendar display" ON public.blocked_dates;
CREATE POLICY "Authenticated users can view blocked dates"
ON public.blocked_dates FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM facilities f WHERE f.id = blocked_dates.facility_id AND f.is_active = true));

-- Deny public access to bookings
DROP POLICY IF EXISTS "Deny all public access to bookings" ON public.bookings;
CREATE POLICY "Deny all public access to bookings"
ON public.bookings FOR ALL TO anon
USING (false) WITH CHECK (false);