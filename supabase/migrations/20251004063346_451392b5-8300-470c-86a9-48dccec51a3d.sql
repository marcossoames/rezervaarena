-- ============================================
-- SECURITY FIX: Bank Details Table RLS Policies
-- ============================================
-- Purpose: Ensure explicit denial of all public access to bank_details
--          and restrict queries to only account owners and admins
-- 
-- CHANGES:
-- 1. Drop existing policies
-- 2. Add explicit DENY policy for all unauthenticated access (comes first)
-- 3. Add command-specific policies (SELECT, INSERT, UPDATE, DELETE) for authenticated users
-- ============================================

-- Drop all existing policies on bank_details
DROP POLICY IF EXISTS "Deny unauthenticated access to bank_details" ON public.bank_details;
DROP POLICY IF EXISTS "Secure bank details access" ON public.bank_details;

-- ============================================
-- STEP 1: DENY ALL PUBLIC ACCESS (This policy is evaluated first)
-- ============================================
CREATE POLICY "block_all_public_access_to_bank_details"
ON public.bank_details
AS RESTRICTIVE
FOR ALL
TO public, anon
USING (false);

-- ============================================
-- STEP 2: ALLOW OWNER AND ADMIN ACCESS (Command-specific policies)
-- ============================================

-- Allow SELECT only for account owner or admin
CREATE POLICY "owner_and_admin_can_select_bank_details"
ON public.bank_details
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
);

-- Allow INSERT only for account owner or admin
CREATE POLICY "owner_and_admin_can_insert_bank_details"
ON public.bank_details
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
);

-- Allow UPDATE only for account owner or admin
CREATE POLICY "owner_and_admin_can_update_bank_details"
ON public.bank_details
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
);

-- Allow DELETE only for account owner or admin
CREATE POLICY "owner_and_admin_can_delete_bank_details"
ON public.bank_details
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
);

-- ============================================
-- VERIFICATION
-- ============================================
-- The policies are now:
-- 1. RESTRICTIVE policy that blocks ALL public/anon access (evaluated first)
-- 2. Command-specific PERMISSIVE policies for authenticated users only
-- 3. Each policy checks: user is the owner OR user is admin
-- This ensures zero chance of public access to banking data