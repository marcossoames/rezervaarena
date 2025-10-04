-- Create function to promote user to admin role
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to promote users to admin
  IF NOT has_role_v2(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  -- Insert admin role into user_roles table
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
$function$;