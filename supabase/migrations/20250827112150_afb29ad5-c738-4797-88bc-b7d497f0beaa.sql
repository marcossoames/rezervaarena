-- Fix the commission calculation logic in the booking security trigger
CREATE OR REPLACE FUNCTION public.validate_booking_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
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