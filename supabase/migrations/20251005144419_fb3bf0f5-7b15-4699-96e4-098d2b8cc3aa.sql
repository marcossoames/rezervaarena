-- Fix login/profile access: remove overly restrictive deny-all policy on profiles
-- This policy was blocking all access even when user-specific/admin policies should allow it.
DROP POLICY IF EXISTS "profiles_deny_all_by_default" ON public.profiles;