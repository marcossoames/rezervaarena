-- Create function to check if a user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
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
      AND role = 'super_admin'::app_role
  )
$$;

-- Create function to demote admin to client (only super admin can do this)
CREATE OR REPLACE FUNCTION public.demote_admin_to_client(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
BEGIN
  -- Only allow super admins to demote admins
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: only super admin can demote administrators';
  END IF;
  
  -- Prevent demoting super admins
  IF is_super_admin(_user_id) THEN
    RAISE EXCEPTION 'Cannot demote super admin';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  -- Remove admin role
  DELETE FROM public.user_roles 
  WHERE user_id = _user_id AND role = 'admin'::app_role;
  
  -- Add client role if not exists
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (_user_id, 'client'::app_role, auth.uid())
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'demote_admin_to_client',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN true;
END;
$function$;

-- Update has_role_v2 to also check for super_admin (super admin has all admin privileges)
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
      AND (role = _role OR role = 'super_admin'::app_role)
  )
$$;

-- Grant super admin role to soamespaul@gmail.com
DO $$
DECLARE
  super_admin_user_id uuid;
BEGIN
  -- Get user ID for soamespaul@gmail.com
  SELECT id INTO super_admin_user_id 
  FROM auth.users 
  WHERE email = 'soamespaul@gmail.com';
  
  IF super_admin_user_id IS NOT NULL THEN
    -- Add super_admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (super_admin_user_id, 'super_admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Super admin role granted to soamespaul@gmail.com';
  ELSE
    RAISE NOTICE 'User soamespaul@gmail.com not found';
  END IF;
END $$;