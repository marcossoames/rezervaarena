-- Creează funcție de testare pentru promovare care acceptă user_id manual
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_test(_caller_user_id uuid, _target_user_id uuid)
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

  -- Determine if caller is admin or super_admin directly from user_roles
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;

  -- Authorization: admin/super_admin or trusted email
  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Access denied: admin privileges required. Caller: %, Is Admin: %', caller_email, caller_is_admin;
  END IF;

  -- Resolve target email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _target_user_id;

  -- If not already admin, insert role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _target_user_id AND role = 'admin'::app_role
  ) INTO already_admin;

  IF NOT already_admin THEN
    INSERT INTO public.user_roles (user_id, role, created_by)
    VALUES (_target_user_id, 'admin'::app_role, _caller_user_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  -- Best-effort audit log
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    _caller_user_id,
    'promote_to_admin_test',
    _target_user_id,
    target_email,
    jsonb_build_object('timestamp', now(), 'by_email', caller_email)
  );

  RETURN true;
END;
$$;

-- Testează direct promovarea
SELECT public.promote_user_to_admin_test(
  'a91e4dd8-8a4c-41ce-8b28-742e3fe6fc0f'::uuid,  -- Paul Admin (super_admin)
  '60a12a02-cc2b-4efd-8262-42d6adfdaf3c'::uuid   -- Cristian (client) -> admin
) as promotion_result;