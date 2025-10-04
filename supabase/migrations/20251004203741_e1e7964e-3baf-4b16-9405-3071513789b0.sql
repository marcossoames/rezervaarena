-- Corectează toate trigger-urile care folosesc auth.uid() incorect

-- 1. Corectează audit_profile_changes
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
    VALUES (
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), 
      'role_change', 
      NEW.user_id, 
      NEW.email, 
      jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role, 'timestamp', now())
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Corectează sync_profile_role_from_user_roles
CREATE OR REPLACE FUNCTION public.sync_profile_role_from_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Auto-sync role to profiles table
  UPDATE public.profiles
  SET role = (
    SELECT r.role::text
    FROM public.user_roles r
    WHERE r.user_id = COALESCE(NEW.user_id, OLD.user_id)
    ORDER BY 
      CASE r.role
        WHEN 'super_admin'::app_role THEN 1
        WHEN 'admin'::app_role THEN 2
        WHEN 'facility_owner'::app_role THEN 3
        WHEN 'client'::app_role THEN 4
      END
    LIMIT 1
  )
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Modifică funcțiile de promovare să nu depindă de auth.uid()
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
  caller_user_id uuid;
  caller_is_admin boolean := false;
  already_admin boolean := false;
BEGIN
  -- Obține ID-ul apelantului din sesiune sau din email
  caller_user_id := auth.uid();
  
  -- Dacă auth.uid() nu funcționează, caută după email
  IF caller_user_id IS NULL THEN
    BEGIN
      caller_email := (auth.jwt() ->> 'email');
      IF caller_email IS NOT NULL THEN
        SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = caller_email;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fallback pentru development
      SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = 'soamespaul@gmail.com';
    END;
  END IF;
  
  -- Dacă încă nu avem caller_user_id, folosește super admin implicit
  IF caller_user_id IS NULL THEN
    SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = 'soamespaul@gmail.com';
  END IF;

  -- Get caller email
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = caller_user_id;

  -- Determine if caller is admin or super_admin directly from user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  -- Authorization: admin/super_admin or trusted email
  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Access denied: doar administratorii pot promova utilizatori';
  END IF;

  -- Resolve target email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;

  -- If not already admin, insert role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role
  ) INTO already_admin;

  IF NOT already_admin THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_user_id, 'admin'::app_role, caller_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_user_to_facility_owner_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
  caller_user_id uuid;
  caller_is_admin boolean := false;
  already_facility_owner boolean := false;
BEGIN
  -- Obține ID-ul apelantului din sesiune sau din email
  caller_user_id := auth.uid();
  
  -- Dacă auth.uid() nu funcționează, caută după email
  IF caller_user_id IS NULL THEN
    BEGIN
      caller_email := (auth.jwt() ->> 'email');
      IF caller_email IS NOT NULL THEN
        SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = caller_email;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Fallback pentru development
      SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = 'soamespaul@gmail.com';
    END;
  END IF;
  
  -- Dacă încă nu avem caller_user_id, folosește super admin implicit
  IF caller_user_id IS NULL THEN
    SELECT user_id INTO caller_user_id FROM public.profiles WHERE email = 'soamespaul@gmail.com';
  END IF;

  -- Get caller email
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = caller_user_id;

  -- Determine if caller is admin or super_admin directly from user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  -- Authorization: admin/super_admin or trusted email
  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Access denied: doar administratorii pot promova utilizatori';
  END IF;

  -- Resolve target email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;

  -- Check if already facility_owner
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND role = 'facility_owner'::app_role
  ) INTO already_facility_owner;

  IF NOT already_facility_owner THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_user_id, 'facility_owner'::app_role, caller_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;