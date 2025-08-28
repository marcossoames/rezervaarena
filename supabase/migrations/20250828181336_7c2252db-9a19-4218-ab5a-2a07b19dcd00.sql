-- Critical Security Fixes Migration

-- 1. Drop the insecure register_facility_with_profile function that allows privilege escalation
DROP FUNCTION IF EXISTS public.register_facility_with_profile(uuid, text, text, text, text, text, facility_type, text, text, numeric, integer, text[], integer);

-- 2. Create triggers to activate booking validation functions
CREATE TRIGGER booking_validation_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER booking_overlap_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

CREATE TRIGGER booking_integrity_trigger
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.protect_booking_integrity();

CREATE TRIGGER client_booking_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_client_booking_stats();

-- 3. Create a secure cash booking function to replace client-side validation
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
AS $$
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
$$;