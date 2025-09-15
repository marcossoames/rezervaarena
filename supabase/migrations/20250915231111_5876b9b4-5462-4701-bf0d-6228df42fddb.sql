-- Update delete_current_user_account to cancel owner facility bookings instead of blocking
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- 1) Cancel client's own future bookings
  UPDATE public.bookings 
  SET status = 'cancelled',
      notes = COALESCE(notes, '') || ' - Anulat automat din cauza ștergerii contului',
      updated_at = now()
  WHERE client_id = current_user_id 
    AND status IN ('confirmed', 'pending');

  -- 2) Cancel future bookings on facilities owned by the user
  UPDATE public.bookings b
  SET status = 'cancelled',
      notes = COALESCE(b.notes, '') || ' - Anulat automat din cauza ștergerii contului proprietarului',
      updated_at = now()
  FROM public.facilities f
  WHERE b.facility_id = f.id
    AND f.owner_id = current_user_id
    AND b.status IN ('confirmed', 'pending');
  
  -- 3) Deactivate facilities (preserve booking history)
  UPDATE public.facilities 
  SET is_active = false, 
      updated_at = now()
  WHERE owner_id = current_user_id;
  
  -- 4) Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = current_user_id;
  
  -- 5) Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN true;
END;
$$;