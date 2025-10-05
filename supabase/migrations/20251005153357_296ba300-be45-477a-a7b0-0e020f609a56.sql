-- Create has_role function as alias to has_role_v2 for backward compatibility
CREATE OR REPLACE FUNCTION public.has_role(_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role_v2(auth.uid(), _role::app_role)
$$;