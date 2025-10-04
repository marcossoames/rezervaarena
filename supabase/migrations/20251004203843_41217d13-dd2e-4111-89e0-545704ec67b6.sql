-- Recreează funcțiile de promovare să accepte caller_user_id explicit
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_v2(_caller_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
  caller_is_admin boolean := false;
  already_admin boolean := false;
BEGIN
  -- Get caller email
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = _caller_user_id;

  -- Determine if caller is admin or super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Doar administratorii pot promova utilizatori';
  END IF;

  SELECT email INTO target_email FROM public.profiles WHERE user_id = _target_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin'::app_role
  ) INTO already_admin;

  IF NOT already_admin THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_target_user_id, 'admin'::app_role, _caller_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (_caller_user_id, 'promote_to_admin', _target_user_id, target_email, 
          jsonb_build_object('timestamp', now(), 'by_email', caller_email));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_user_to_facility_owner_v2(_caller_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
  caller_is_admin boolean := false;
  already_facility_owner boolean := false;
BEGIN
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = _caller_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Doar administratorii pot promova utilizatori';
  END IF;

  SELECT email INTO target_email FROM public.profiles WHERE user_id = _target_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _target_user_id AND role = 'facility_owner'::app_role
  ) INTO already_facility_owner;

  IF NOT already_facility_owner THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_target_user_id, 'facility_owner'::app_role, _caller_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (_caller_user_id, 'promote_to_facility_owner', _target_user_id, target_email,
          jsonb_build_object('timestamp', now(), 'by_email', caller_email));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.demote_admin_to_client_v2(_caller_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
BEGIN
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = _caller_user_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _caller_user_id AND role = 'super_admin'::app_role
  ) AND caller_email != 'soamespaul@gmail.com' THEN
    RAISE EXCEPTION 'Doar super admin poate demota administratori';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _target_user_id AND role = 'super_admin'::app_role
  ) THEN
    RAISE EXCEPTION 'Nu poți demota super admin';
  END IF;
  
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _target_user_id;
  
  DELETE FROM public.user_roles 
  WHERE user_id = _target_user_id AND role = 'admin'::app_role;
  
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_target_user_id, 'client'::app_role, _caller_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (_caller_user_id, 'demote_admin_to_client', _target_user_id, target_email,
          jsonb_build_object('timestamp', now()));
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_user_to_admin_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_facility_owner_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_admin_to_client_v2(uuid, uuid) TO authenticated;