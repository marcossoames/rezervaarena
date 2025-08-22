-- Create a function to promote user to admin after they sign up
CREATE OR REPLACE FUNCTION promote_user_to_admin(user_email TEXT)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin'::user_role 
  WHERE email = user_email;
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$;

-- Create a trigger to automatically set admin role for specific emails
CREATE OR REPLACE FUNCTION auto_promote_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if this is the admin email and promote automatically
  IF NEW.email = 'soamespaul@gmail.com' THEN
    NEW.role = 'admin'::user_role;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-promote specific emails
DROP TRIGGER IF EXISTS auto_promote_admin_trigger ON public.profiles;
CREATE TRIGGER auto_promote_admin_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_admin();