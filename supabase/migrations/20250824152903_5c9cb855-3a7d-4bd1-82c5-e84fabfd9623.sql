-- Add Stripe Connect fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN stripe_account_id TEXT,
ADD COLUMN stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN stripe_payouts_enabled BOOLEAN DEFAULT FALSE;

-- Add Stripe Connect payment tracking fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN stripe_payment_intent_id TEXT,
ADD COLUMN stripe_charge_id TEXT,
ADD COLUMN stripe_transfer_id TEXT,
ADD COLUMN platform_fee_amount NUMERIC,
ADD COLUMN facility_owner_amount NUMERIC,
ADD COLUMN stripe_application_fee_amount NUMERIC;