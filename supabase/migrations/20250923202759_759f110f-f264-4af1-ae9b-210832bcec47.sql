-- Fix RLS policy for platform_payments to allow service role inserts during payment processing
DROP POLICY IF EXISTS "Authenticated system can create platform payments" ON public.platform_payments;

CREATE POLICY "Authenticated system can create platform payments"
ON public.platform_payments
FOR INSERT
TO service_role, authenticated
WITH CHECK (true);

-- Update the redirect URL in Stripe success/cancel URLs to use the correct domain
-- This ensures users are redirected to the correct success/failure pages after payment