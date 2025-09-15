-- Fix the update_booking_status_owner function to properly handle status updates
-- by ensuring it only updates specific fields and bypasses the integrity trigger

DROP FUNCTION IF EXISTS public.update_booking_status_owner(uuid, booking_status, text);

CREATE OR REPLACE FUNCTION public.update_booking_status_owner(
  p_booking_id uuid, 
  p_new_status booking_status, 
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_current_booking RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get current booking and facility owner info
  SELECT 
    b.id, b.status, b.notes, b.total_price, b.total_amount, 
    b.platform_fee_amount, b.facility_owner_amount, b.client_id,
    f.owner_id
  INTO v_current_booking, v_owner_id
  FROM bookings b
  JOIN facilities f ON f.id = b.facility_id
  WHERE b.id = p_booking_id;
  
  IF v_current_booking.id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Ensure caller is owner or admin
  IF v_owner_id != auth.uid() AND NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update ONLY status and notes, preserving all financial data exactly
  -- This approach ensures no financial fields are modified, avoiding the trigger
  UPDATE bookings
  SET 
    status = p_new_status,
    notes = CASE 
      WHEN p_notes IS NOT NULL AND p_notes != '' THEN p_notes
      ELSE notes
    END,
    updated_at = now(),
    -- Explicitly preserve all financial fields to avoid trigger issues
    total_price = v_current_booking.total_price,
    total_amount = v_current_booking.total_amount,
    platform_fee_amount = v_current_booking.platform_fee_amount,
    facility_owner_amount = v_current_booking.facility_owner_amount
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;