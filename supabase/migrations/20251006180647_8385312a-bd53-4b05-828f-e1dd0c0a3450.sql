-- Add blocked interval validation to booking creation and trigger validation
-- 1) Update validate_booking_security to reject blocked dates/intervals
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
  should_recalculate boolean := false;
BEGIN
  -- Determine when to (re)calculate: on INSERT or when time/facility/date changed
  IF TG_OP = 'INSERT' THEN
    should_recalculate := true;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.start_time IS DISTINCT FROM NEW.start_time)
       OR (OLD.end_time IS DISTINCT FROM NEW.end_time)
       OR (OLD.booking_date IS DISTINCT FROM NEW.booking_date)
       OR (OLD.facility_id IS DISTINCT FROM NEW.facility_id) THEN
      should_recalculate := true;
    END IF;
  END IF;

  -- Only run validations and calculations when needed
  IF should_recalculate THEN
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

    -- NEW: Reject bookings on blocked dates/intervals
    -- Full-day blocks
    IF EXISTS (
      SELECT 1 FROM public.blocked_dates bd
      WHERE bd.facility_id = NEW.facility_id
        AND bd.blocked_date = NEW.booking_date
        AND bd.start_time IS NULL AND bd.end_time IS NULL
    ) THEN
      RAISE EXCEPTION 'Booking time is blocked for the selected date';
    END IF;

    -- Partial blocks that overlap the requested interval
    IF EXISTS (
      SELECT 1 FROM public.blocked_dates bd
      WHERE bd.facility_id = NEW.facility_id
        AND bd.blocked_date = NEW.booking_date
        AND bd.start_time IS NOT NULL AND bd.end_time IS NOT NULL
        AND (NEW.start_time, NEW.end_time) OVERLAPS (bd.start_time, bd.end_time)
    ) THEN
      RAISE EXCEPTION 'Booking time overlaps with a blocked interval';
    END IF;
    
    -- Calculate duration and total price SERVER-SIDE (ignore client values to prevent manipulation)
    calculated_duration := NEW.end_time - NEW.start_time;
    calculated_hours := EXTRACT(EPOCH FROM calculated_duration) / 3600.0;
    calculated_total := calculated_hours * facility_record.price_per_hour;
    
    -- Override client-provided values with server-calculated ones
    NEW.total_price := calculated_total;
    NEW.total_amount := calculated_total;
    
    -- Set platform fee calculations based on payment method
    -- Both cash and card: platform gets 10%, facility owner gets 90%
    NEW.platform_fee_amount := calculated_total * 0.10;
    NEW.facility_owner_amount := calculated_total * 0.90;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2) Update create_cash_booking_secure to also reject blocked intervals explicitly
CREATE OR REPLACE FUNCTION public.create_cash_booking_secure(p_facility_id uuid, p_booking_date date, p_start_time time without time zone, p_end_time time without time zone)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    booking_id uuid;
    facility_record RECORD;
    calculated_duration INTERVAL;
    calculated_hours NUMERIC;
    calculated_total NUMERIC;
    current_user_id uuid;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    -- Get facility details for validation
    SELECT f.price_per_hour, f.operating_hours_start, f.operating_hours_end, f.is_active, f.owner_id
    INTO facility_record
    FROM public.facilities f
    WHERE f.id = p_facility_id;
    
    -- Validate facility exists and is active
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Facility not found or inactive';
    END IF;
    
    IF NOT facility_record.is_active THEN
        RAISE EXCEPTION 'Cannot book inactive facility';
    END IF;
    
    -- Validate booking is not in the past
    IF p_booking_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Cannot book dates in the past';
    END IF;
    
    -- Validate time range
    IF p_start_time >= p_end_time THEN
        RAISE EXCEPTION 'Start time must be before end time';
    END IF;
    
    -- Validate operating hours
    IF facility_record.operating_hours_start IS NOT NULL AND facility_record.operating_hours_end IS NOT NULL THEN
        IF p_start_time < facility_record.operating_hours_start OR p_end_time > facility_record.operating_hours_end THEN
            RAISE EXCEPTION 'Booking time is outside facility operating hours';
        END IF;
    END IF;

    -- NEW: Reject bookings on blocked dates/intervals
    -- Full-day blocks
    IF EXISTS (
      SELECT 1 FROM public.blocked_dates bd
      WHERE bd.facility_id = p_facility_id
        AND bd.blocked_date = p_booking_date
        AND bd.start_time IS NULL AND bd.end_time IS NULL
    ) THEN
      RAISE EXCEPTION 'Selected interval is blocked (interval blocat)';
    END IF;

    -- Partial blocks
    IF EXISTS (
      SELECT 1 FROM public.blocked_dates bd
      WHERE bd.facility_id = p_facility_id
        AND bd.blocked_date = p_booking_date
        AND bd.start_time IS NOT NULL AND bd.end_time IS NOT NULL
        AND (p_start_time, p_end_time) OVERLAPS (bd.start_time, bd.end_time)
    ) THEN
      RAISE EXCEPTION 'Selected interval overlaps a blocked period (interval blocat)';
    END IF;
    
    -- Check for overlapping bookings
    IF EXISTS (
        SELECT 1 FROM public.bookings 
        WHERE facility_id = p_facility_id 
        AND booking_date = p_booking_date
        AND status IN ('confirmed', 'pending')
        AND (p_start_time, p_end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'Booking time overlaps with existing booking';
    END IF;
    
    -- Calculate SERVER-SIDE pricing (never trust client)
    calculated_duration := p_end_time - p_start_time;
    calculated_hours := EXTRACT(EPOCH FROM calculated_duration) / 3600.0;
    calculated_total := calculated_hours * facility_record.price_per_hour;
    
    -- Create booking with server-calculated values
    INSERT INTO public.bookings (
        client_id,
        facility_id,
        booking_date,
        start_time,
        end_time,
        total_price,
        total_amount,
        platform_fee_amount,
        facility_owner_amount,
        payment_method,
        status
    ) VALUES (
        current_user_id,
        p_facility_id,
        p_booking_date,
        p_start_time,
        p_end_time,
        calculated_total,
        calculated_total,
        calculated_total * 0.10, -- 10% platform fee
        calculated_total, -- Full amount to facility owner for cash payments
        'cash',
        'confirmed' -- Cash bookings are immediately confirmed
    ) RETURNING id INTO booking_id;
    
    RETURN booking_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating booking: %', SQLERRM;
END;
$function$;