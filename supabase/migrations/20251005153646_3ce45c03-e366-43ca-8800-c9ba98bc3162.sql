-- Add overload to match existing references: has_role(user_role)
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT has_role_v2(auth.uid(), (_role::text)::app_role)
$$;