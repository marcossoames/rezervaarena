-- Remove the auto-promote admin trigger and function
DROP TRIGGER IF EXISTS auto_promote_admin_trigger ON public.profiles;

DROP FUNCTION IF EXISTS auto_promote_admin();

-- Keep the promote_user_to_admin function as it might be useful for manual promotions