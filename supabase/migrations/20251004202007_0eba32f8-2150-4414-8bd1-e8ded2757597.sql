-- Make promotion independent of helper functions and allow trusted email
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
  caller_email text;
  caller_is_admin boolean := false;
  already_admin boolean := false;
BEGIN
  -- Get caller email from JWT first (robust) then fallback to profiles
  BEGIN
    caller_email := (auth.jwt() ->> 'email');
  EXCEPTION WHEN OTHERS THEN
    caller_email := NULL;
  END;

  IF caller_email IS NULL THEN
    SELECT email INTO caller_email FROM public.profiles WHERE user_id = auth.uid();
  END IF;

  -- Determine if caller is admin or super_admin directly from user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  -- Authorization: admin/super_admin or trusted email
  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;

  -- Resolve target email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;

  -- If not already admin, insert role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role
  ) INTO already_admin;

  IF NOT already_admin THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_user_id, 'admin'::app_role, auth.uid())
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Best-effort audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'promote_to_admin',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now(), 'by_email', caller_email)
  );

  RETURN true;
END;
$function$;