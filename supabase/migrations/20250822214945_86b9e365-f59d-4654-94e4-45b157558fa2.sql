-- Add RLS policy to allow public viewing of active facilities
-- This is essential for customers to browse and book facilities

CREATE POLICY "Allow public viewing of active facilities" 
ON public.facilities 
FOR SELECT 
USING (is_active = true);

-- This policy allows anyone (authenticated or not) to view facilities 
-- that are marked as active, which is necessary for:
-- 1. Public browsing of available facilities
-- 2. Facility search and filtering
-- 3. Booking functionality
-- 4. Marketing and discovery

-- The policy is secure because:
-- 1. Only active facilities are visible (is_active = true)
-- 2. It's read-only (SELECT only)
-- 3. No sensitive owner information is exposed through this policy
-- 4. Full facility details are still controlled by our SECURITY DEFINER functions