-- Create RPC function for updating booking status by facility owners
CREATE OR REPLACE FUNCTION public.update_booking_status_owner(
  p_booking_id uuid,
  p_new_status booking_status,
  p_notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  facility_owner_id uuid;
  booking_client_id uuid;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Get facility owner and client ID for this booking
  SELECT f.owner_id, b.client_id
  INTO facility_owner_id, booking_client_id
  FROM public.bookings b
  JOIN public.facilities f ON b.facility_id = f.id
  WHERE b.id = p_booking_id;
  
  IF facility_owner_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Check permissions: must be facility owner, admin, or the client themselves
  IF NOT (
    current_user_id = facility_owner_id OR 
    has_role('admin'::user_role) OR
    current_user_id = booking_client_id
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  -- Update the booking status and notes
  UPDATE public.bookings 
  SET 
    status = p_new_status,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update booking status';
  END IF;
  
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error updating booking status: %', SQLERRM;
END;
$$;