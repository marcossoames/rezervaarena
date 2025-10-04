-- Enforce single super_admin and restrict it to a specific email
-- 1) Cleanup any existing super_admin roles not tied to the designated email
DO $$ BEGIN
  DELETE FROM public.user_roles ur
  USING public.profiles p
  WHERE ur.user_id = p.user_id
    AND ur.role = 'super_admin'::app_role
    AND p.email <> 'soamespaul@gmail.com';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- 2) Allow only one global super_admin row via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_super_admin_only_one
ON public.user_roles ((role))
WHERE role = 'super_admin'::app_role;

-- 3) Enforce that only the designated email can be assigned super_admin
CREATE OR REPLACE FUNCTION public.enforce_super_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin'::app_role THEN
    PERFORM 1 FROM public.profiles p
    WHERE p.user_id = NEW.user_id
      AND p.email = 'soamespaul@gmail.com';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Only % can be super_admin', 'soamespaul@gmail.com';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_super_admin_email ON public.user_roles;
CREATE TRIGGER trg_enforce_super_admin_email
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_super_admin_email();

-- 4) Ensure super_admin role exists for the designated email
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'super_admin'::app_role
FROM public.profiles p
WHERE p.email = 'soamespaul@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;