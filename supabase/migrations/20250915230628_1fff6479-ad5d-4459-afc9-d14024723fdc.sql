-- Fix the delete_current_user_account function to remove problematic timestamp operations
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  facility_count integer;
  booking_count integer;
  active_bookings_count integer;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Count related data before deletion
  SELECT COUNT(*) INTO facility_count FROM facilities WHERE owner_id = current_user_id;
  SELECT COUNT(*) INTO booking_count FROM bookings WHERE client_id = current_user_id;
  SELECT COUNT(*) INTO active_bookings_count FROM bookings 
    WHERE client_id = current_user_id 
    AND booking_date >= CURRENT_DATE 
    AND status IN ('confirmed', 'pending');
  
  -- Don't allow deletion if user owns facilities with future bookings
  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    WHERE f.owner_id = current_user_id 
    AND b.booking_date >= CURRENT_DATE 
    AND b.status IN ('confirmed', 'pending')
  ) THEN
    RAISE EXCEPTION 'Cannot delete account with facilities that have future bookings.';
  END IF;
  
  -- Cancel ALL user's bookings (past and future) and add cancellation note
  UPDATE public.bookings 
  SET status = 'cancelled',
      notes = COALESCE(notes, '') || ' - Anulat automat din cauza ștergerii contului',
      updated_at = now()
  WHERE client_id = current_user_id 
  AND status IN ('confirmed', 'pending');
  
  -- Deactivate facilities instead of deleting them (preserve booking history)
  UPDATE public.facilities 
  SET is_active = false, 
      updated_at = now()
  WHERE owner_id = current_user_id;
  
  -- Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = current_user_id;
  
  -- Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN true;
END;
$$;