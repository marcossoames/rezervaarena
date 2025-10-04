-- Create function to demote facility_owner to client (available to admins and super_admin)
CREATE OR REPLACE FUNCTION public.demote_facility_owner_to_client_v2(_caller_user_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_email text;
  caller_email text;
  caller_is_admin boolean := false;
BEGIN
  SELECT email INTO caller_email FROM public.profiles WHERE user_id = _caller_user_id;
  
  -- Check if caller is admin or super_admin
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _caller_user_id AND role IN ('admin'::app_role, 'super_admin'::app_role)
  ) INTO caller_is_admin;
  
  IF NOT (caller_is_admin OR caller_email = 'soamespaul@gmail.com') THEN
    RAISE EXCEPTION 'Doar administratorii pot demota utilizatori';
  END IF;
  
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _target_user_id;
  
  -- Remove facility_owner role
  DELETE FROM public.user_roles 
  WHERE user_id = _target_user_id AND role = 'facility_owner'::app_role;
  
  -- Add client role if not exists
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_target_user_id, 'client'::app_role, _caller_user_id)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (_caller_user_id, 'demote_facility_owner_to_client', _target_user_id, target_email,
          jsonb_build_object('timestamp', now()));
  
  RETURN true;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.demote_facility_owner_to_client_v2(uuid, uuid) TO authenticated;