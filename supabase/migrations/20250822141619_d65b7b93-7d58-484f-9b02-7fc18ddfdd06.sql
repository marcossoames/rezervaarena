-- Create function to delete user account (admin only)
CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Delete from profiles table first (cascade will handle the rest)
  DELETE FROM public.profiles WHERE user_id = _user_id;
  
  -- Delete from auth.users (this will cascade delete all related data)
  DELETE FROM auth.users WHERE id = _user_id;
  
  RETURN FOUND;
END;
$function$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account_secure(uuid) TO authenticated;