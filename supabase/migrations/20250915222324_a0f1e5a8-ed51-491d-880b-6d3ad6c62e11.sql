-- Fix the update_booking_status_owner function with correct syntax
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
  v_booking_exists boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- First check if booking exists and get facility owner
  SELECT f.owner_id, true
  INTO v_owner_id, v_booking_exists
  FROM bookings b
  JOIN facilities f ON f.id = b.facility_id
  WHERE b.id = p_booking_id;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Ensure caller is owner or admin
  IF v_owner_id != auth.uid() AND NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Update ONLY status and notes - this avoids the financial calculation trigger
  UPDATE bookings
  SET 
    status = p_new_status,
    notes = CASE 
      WHEN p_notes IS NOT NULL AND p_notes != '' THEN p_notes
      ELSE notes
    END,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;