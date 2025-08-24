-- Add Stripe payment fields to bookings table
ALTER TABLE public.bookings 
ADD COLUMN payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card')),
ADD COLUMN stripe_session_id TEXT,
ADD COLUMN stripe_payment_intent_id TEXT,
ADD COLUMN total_amount NUMERIC;