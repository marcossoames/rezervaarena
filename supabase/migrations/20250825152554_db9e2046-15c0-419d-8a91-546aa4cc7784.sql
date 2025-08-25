-- Security Fix 1: Add comprehensive booking validation trigger
CREATE OR REPLACE FUNCTION public.validate_booking_security()
RETURNS TRIGGER AS $$
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
  
  -- Set platform fee calculations (10% for cash, varies for card)
  IF NEW.payment_method = 'cash' THEN
    NEW.platform_fee_amount := calculated_total * 0.10;
    NEW.facility_owner_amount := calculated_total * 0.90;
  ELSE
    -- For card payments, these will be set by the payment processor
    NEW.platform_fee_amount := COALESCE(NEW.platform_fee_amount, 0);
    NEW.facility_owner_amount := COALESCE(NEW.facility_owner_amount, calculated_total);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the validation trigger
DROP TRIGGER IF EXISTS booking_security_validation ON public.bookings;
CREATE TRIGGER booking_security_validation
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_security();

-- Attach the existing overlap prevention trigger (if not already attached)
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
CREATE TRIGGER prevent_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_booking_overlap();