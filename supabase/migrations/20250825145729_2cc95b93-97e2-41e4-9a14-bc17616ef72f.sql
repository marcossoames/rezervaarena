-- First part: Add new status to enum and basic columns
ALTER TYPE booking_status ADD VALUE 'no_show';

-- Add tracking fields for client behavior statistics
ALTER TABLE public.profiles ADD COLUMN total_bookings INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN completed_bookings INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN no_show_bookings INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN cancelled_bookings INTEGER DEFAULT 0;