-- Step 1: Drop the blocking trigger
DROP TRIGGER IF EXISTS prevent_role_updates ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_role_column_updates();

-- Step 2: Add role column back to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text;

-- Step 3: Backfill roles from user_roles table
UPDATE public.profiles p
SET role = (
  SELECT r.role::text
  FROM public.user_roles r
  WHERE r.user_id = p.user_id
  ORDER BY 
    CASE r.role
      WHEN 'admin' THEN 1
      WHEN 'facility_owner' THEN 2
      WHEN 'client' THEN 3
    END
  LIMIT 1
);

-- Step 4: Create auto-sync trigger when user_roles changes
CREATE OR REPLACE FUNCTION public.sync_profile_role_from_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-sync role to profiles table
  UPDATE public.profiles
  SET role = (
    SELECT r.role::text
    FROM public.user_roles r
    WHERE r.user_id = COALESCE(NEW.user_id, OLD.user_id)
    ORDER BY 
      CASE r.role
        WHEN 'admin' THEN 1
        WHEN 'facility_owner' THEN 2
        WHEN 'client' THEN 3
      END
    LIMIT 1
  )
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS auto_sync_profile_role ON public.user_roles;
CREATE TRIGGER auto_sync_profile_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_from_user_roles();

-- Add security comment
COMMENT ON COLUMN public.profiles.role IS 'COMPUTED: Primary role auto-synced from user_roles table. This is a convenience field for frontend compatibility. ALL authorization MUST check user_roles table directly using has_role_v2().';