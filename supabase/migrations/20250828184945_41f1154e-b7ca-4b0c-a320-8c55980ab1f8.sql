-- Simplify booking statuses and improve payment flow
-- Update booking status enum to remove 'pending' and add clearer statuses
ALTER TYPE booking_status RENAME TO booking_status_old;
CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'cancelled', 'no_show');

-- Update all existing 'pending' bookings to 'confirmed' since they should be valid bookings
UPDATE public.bookings SET status = 'confirmed' WHERE status = 'pending';

-- Now we can safely change the column type
ALTER TABLE public.bookings 
  ALTER COLUMN status TYPE booking_status USING status::text::booking_status;

-- Drop the old enum
DROP TYPE booking_status_old;

-- Update the cash booking function to reflect the simplified logic
CREATE OR REPLACE FUNCTION public.create_cash_booking_secure(
    p_facility_id uuid,
    p_booking_date date,
    p_start_time time,
    p_end_time time
)
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
    
    -- Check for overlapping bookings (only confirmed bookings matter now)
    IF EXISTS (
        SELECT 1 FROM public.bookings 
        WHERE facility_id = p_facility_id 
        AND booking_date = p_booking_date
        AND status = 'confirmed'
        AND (p_start_time, p_end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'Booking time overlaps with existing booking';
    END IF;
    
    -- Calculate SERVER-SIDE pricing
    calculated_duration := p_end_time - p_start_time;
    calculated_hours := EXTRACT(EPOCH FROM calculated_duration) / 3600.0;
    calculated_total := calculated_hours * facility_record.price_per_hour;
    
    -- Create confirmed booking (cash payments are immediate)
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
        calculated_total * 0.10,
        calculated_total,
        'cash',
        'confirmed'
    ) RETURNING id INTO booking_id;
    
    RETURN booking_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating booking: %', SQLERRM;
END;
$function$