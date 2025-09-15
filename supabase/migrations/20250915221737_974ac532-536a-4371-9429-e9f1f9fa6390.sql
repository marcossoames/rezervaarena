-- Secure RPC to let facility owners (or admins) update booking status
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Find facility owner for the booking
  SELECT f.owner_id INTO v_owner_id
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

  -- Update booking status (financial fields protected by existing trigger)
  UPDATE bookings
  SET 
    status = p_new_status,
    notes = COALESCE(NULLIF(p_notes, ''), notes),
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN FOUND;
END;
$$;