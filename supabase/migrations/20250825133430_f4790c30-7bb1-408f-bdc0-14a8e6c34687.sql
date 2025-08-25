-- Add bank account info to profiles
ALTER TABLE public.profiles 
ADD COLUMN bank_name TEXT,
ADD COLUMN iban TEXT,
ADD COLUMN account_holder_name TEXT;

-- Remove Stripe Connect related columns since they're no longer needed
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS stripe_account_id,
DROP COLUMN IF EXISTS stripe_onboarding_complete,
DROP COLUMN IF EXISTS stripe_charges_enabled,
DROP COLUMN IF EXISTS stripe_payouts_enabled;