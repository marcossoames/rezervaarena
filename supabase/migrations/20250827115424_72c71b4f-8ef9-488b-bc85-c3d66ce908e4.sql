-- Security fixes migration

-- 1. Lock down facilities SELECT policy
DROP POLICY IF EXISTS "Facility owners and admins can view their facilities" ON public.facilities;

-- Create stricter SELECT policy for facilities
CREATE POLICY "Facility owners and admins can view their facilities" 
ON public.facilities 
FOR SELECT 
USING (owner_id = auth.uid() OR has_role('admin'::user_role));

-- 2. Tighten storage INSERT policy for facility-images
DROP POLICY IF EXISTS "Facility owners can upload facility images" ON storage.objects;

CREATE POLICY "Facility owners can upload facility images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Harden SECURITY DEFINER functions with search_path
CREATE OR REPLACE FUNCTION public.validate_booking_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  facility_record RECORD;
  calculated_duration INTERVAL;
  calculated_hours NUMERIC;
  calculated_total NUMERIC;
BEGIN
  -- Get facility details for validation
  SELECT f.price_per_hour, f.operating_hours_start, f.operating_hours_end, f.is_active
  INTO facility_record
  FROM public.facilities f
  WHERE f.id = NEW.facility_id;
  
  -- Ensure facility exists and is active
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility not found or inactive';
  END IF;
  
  IF NOT facility_record.is_active THEN
    RAISE EXCEPTION 'Cannot book inactive facility';
  END IF;
  
  -- Validate booking is not in the past
  IF NEW.booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot book dates in the past';
  END IF;
  
  -- Validate time range
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Validate operating hours (if set)
  IF facility_record.operating_hours_start IS NOT NULL AND facility_record.operating_hours_end IS NOT NULL THEN
    IF NEW.start_time < facility_record.operating_hours_start OR NEW.end_time > facility_record.operating_hours_end THEN
      RAISE EXCEPTION 'Booking time is outside facility operating hours';
    END IF;
  END IF;
  
  -- Calculate duration and total price SERVER-SIDE (ignore client values)
  calculated_duration := NEW.end_time - NEW.start_time;
  calculated_hours := EXTRACT(EPOCH FROM calculated_duration) / 3600.0;
  calculated_total := calculated_hours * facility_record.price_per_hour;
  
  -- Override client-provided values with server-calculated ones
  NEW.total_price := calculated_total;
  NEW.total_amount := calculated_total;
  
  -- Set platform fee calculations based on payment method
  IF NEW.payment_method = 'cash' THEN
    -- For cash payments: facility gets full amount, platform gets 10% commission when completed
    NEW.platform_fee_amount := calculated_total * 0.10;
    NEW.facility_owner_amount := calculated_total; -- Facility gets full amount for cash bookings
  ELSE
    -- For card payments: platform receives full amount, transfers 90% to facility
    NEW.platform_fee_amount := calculated_total * 0.10; -- Platform keeps 10%
    NEW.facility_owner_amount := calculated_total * 0.90; -- Facility gets 90%
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update other SECURITY DEFINER functions to include search_path
CREATE OR REPLACE FUNCTION public.protect_booking_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admins to modify critical financial fields
  IF NOT has_role('admin'::user_role) THEN
    -- Prevent changes to calculated amounts
    IF OLD.total_price != NEW.total_price OR 
       OLD.total_amount != NEW.total_amount OR
       OLD.platform_fee_amount != NEW.platform_fee_amount OR
       OLD.facility_owner_amount != NEW.facility_owner_amount THEN
      RAISE EXCEPTION 'Only admins can modify financial calculations';
    END IF;
    
    -- Prevent changes to Stripe IDs
    IF OLD.stripe_session_id != NEW.stripe_session_id OR
       OLD.stripe_payment_intent_id != NEW.stripe_payment_intent_id OR
       OLD.stripe_charge_id != NEW.stripe_charge_id THEN
      RAISE EXCEPTION 'Only admins can modify Stripe identifiers';
    END IF;
    
    -- Prevent changes to client_id and facility_id
    IF OLD.client_id != NEW.client_id OR OLD.facility_id != NEW.facility_id THEN
      RAISE EXCEPTION 'Cannot change booking ownership or facility';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 5. Clean up duplicate triggers and ensure proper order
-- Drop any duplicate triggers first
DROP TRIGGER IF EXISTS check_booking_overlap ON public.bookings;
DROP TRIGGER IF EXISTS prevent_booking_overlap ON public.bookings;

-- Ensure we have the right triggers in the right order
DROP TRIGGER IF EXISTS validate_booking_security_trigger ON public.bookings;
CREATE TRIGGER validate_booking_security_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_security();

DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
CREATE TRIGGER prevent_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_booking_overlap();

DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
CREATE TRIGGER protect_booking_integrity_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION protect_booking_integrity();

-- Create function to get facility owner ID for payment page
CREATE OR REPLACE FUNCTION public.get_facility_owner_id(_facility_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT owner_id 
  FROM facilities 
  WHERE id = _facility_id 
    AND is_active = true
    AND auth.uid() IS NOT NULL;
$function$;