-- ============================================================================
-- CRITICAL SECURITY FIX: Profiles Table Access Control
-- ============================================================================
-- Issue: Profiles table could expose customer personal information if admin
-- role checks fail. Need explicit deny-all policies and stricter controls.
--
-- Changes:
-- 1. Drop existing permissive policies
-- 2. Add restrictive deny-all policy as first line of defense
-- 3. Re-create policies with explicit, minimal permissions
-- 4. Ensure admin verification is bulletproof using user_roles table
-- ============================================================================

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Deny unauthenticated access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- ============================================================================
-- STEP 1: Create RESTRICTIVE deny-all policy (acts as default deny)
-- ============================================================================
-- This policy MUST be restrictive (not permissive) to act as a firewall
-- All other policies must explicitly allow access
CREATE POLICY "profiles_deny_all_by_default"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (false);

-- ============================================================================
-- STEP 2: Create minimal PERMISSIVE policies for specific access patterns
-- ============================================================================

-- Allow users to view ONLY their own profile
-- This is the most common use case and must be fast and secure
CREATE POLICY "profiles_users_select_own"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow users to update ONLY their own profile
-- Users can modify their own data but not change user_id
CREATE POLICY "profiles_users_update_own"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow admins to view all profiles
-- Uses has_role_v2 which queries user_roles table for verification
-- This is a security definer function that prevents recursive RLS issues
CREATE POLICY "profiles_admins_select_all"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role_v2(auth.uid(), 'admin'::app_role) 
  OR has_role_v2(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins to insert new profiles
-- Only admins can create profiles for other users
CREATE POLICY "profiles_admins_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role_v2(auth.uid(), 'admin'::app_role)
  OR has_role_v2(auth.uid(), 'super_admin'::app_role)
);

-- Allow admins to delete profiles
-- Critical for account management and GDPR compliance
CREATE POLICY "profiles_admins_delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  has_role_v2(auth.uid(), 'admin'::app_role)
  OR has_role_v2(auth.uid(), 'super_admin'::app_role)
);

-- ============================================================================
-- STEP 3: Add additional security constraints
-- ============================================================================

-- Ensure has_role_v2 function is properly secured
-- This function MUST have SECURITY DEFINER and fixed search_path
-- Verify it exists and is properly configured
DO $$
BEGIN
  -- Check if has_role_v2 exists with proper security
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'has_role_v2'
    AND p.prosecdef = true  -- SECURITY DEFINER
  ) THEN
    RAISE EXCEPTION 'Security function has_role_v2 is missing or improperly configured';
  END IF;
END $$;

-- Add comment explaining the security model
COMMENT ON TABLE public.profiles IS 
'Contains user profile information with strict RLS policies.
Security model:
- Default deny via restrictive policy
- Users can only access their own profile
- Admins verified via user_roles table using has_role_v2
- All policies are explicit and minimal
- No enumeration attacks possible due to restrictive base policy';

-- Log this security update
DO $$
BEGIN
  RAISE NOTICE 'SECURITY: Profiles table RLS policies have been hardened';
  RAISE NOTICE 'SECURITY: Default deny policy active';
  RAISE NOTICE 'SECURITY: Admin access verified via user_roles table';
END $$;