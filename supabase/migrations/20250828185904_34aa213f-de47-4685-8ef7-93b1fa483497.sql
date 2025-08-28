-- Add public access policy for facilities table to allow browsing
-- This fixes the critical business issue where potential customers cannot browse available facilities

-- Add a policy to allow public users to view active facilities
CREATE POLICY "Public users can view active facilities for browsing"
ON public.facilities
FOR SELECT
USING (is_active = true);

-- This policy ensures that:
-- 1. Only active facilities are visible to the public
-- 2. All basic facility information needed for browsing is accessible
-- 3. Sensitive information like exact addresses are handled by the RPC functions
-- 4. The existing RPC functions can now work properly for unauthenticated users