-- Add only the missing Stripe Connect fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE;

-- Add only the missing Stripe Connect payment tracking fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS platform_fee_amount NUMERIC,
ADD COLUMN IF NOT EXISTS facility_owner_amount NUMERIC,
ADD COLUMN IF NOT EXISTS stripe_application_fee_amount NUMERIC;