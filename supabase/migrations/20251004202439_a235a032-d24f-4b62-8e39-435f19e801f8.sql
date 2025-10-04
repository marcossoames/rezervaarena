-- 1) Enforce a single super_admin in user_roles
CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin'::app_role THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE role = 'super_admin'::app_role
        AND user_id <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'Only one super_admin is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.user_roles;
CREATE TRIGGER trg_enforce_single_super_admin
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_super_admin();

-- 2) Ensure the email `soamespaul@gmail.com` is the single super admin
DO $$
DECLARE
  su_id uuid;
BEGIN
  SELECT user_id INTO su_id
  FROM public.profiles
  WHERE lower(email) = lower('soamespaul@gmail.com')
  LIMIT 1;

  IF su_id IS NOT NULL THEN
    -- Insert super_admin role for this user if missing
    INSERT INTO public.user_roles (user_id, role)
    VALUES (su_id, 'super_admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Remove super_admin from any other users
    DELETE FROM public.user_roles
    WHERE role = 'super_admin'::app_role
      AND user_id <> su_id;
  END IF;
END $$;

-- 3) Make sure our admin promotion RPC uses user_roles (already done in previous migration)
-- Grant execute to authenticated just in case
GRANT EXECUTE ON FUNCTION public.promote_user_to_admin_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_user_to_facility_owner_secure(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.demote_admin_to_client(uuid) TO authenticated;