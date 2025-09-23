-- Add facility_name and facility_address columns to bookings table
-- to preserve facility information when facilities are deleted

ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS facility_name text,
ADD COLUMN IF NOT EXISTS facility_address text;

-- Update existing bookings to include facility information
UPDATE public.bookings 
SET 
  facility_name = f.name,
  facility_address = f.address
FROM public.facilities f
WHERE bookings.facility_id = f.id
  AND bookings.facility_name IS NULL;

-- Update the delete function to preserve facility information
CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_email text;
  facility_count integer;
  booking_count integer;
  active_booking_count integer;
  facility_names text[];
  client_emails text[];
  booking_ids uuid[];
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email and count related data before deletion
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  SELECT COUNT(*) INTO facility_count FROM facilities WHERE owner_id = _user_id;
  SELECT COUNT(*) INTO booking_count FROM bookings WHERE client_id = _user_id;
  
  -- Check for active bookings on facilities owned by this user
  SELECT COUNT(*) INTO active_booking_count 
  FROM bookings b 
  JOIN facilities f ON b.facility_id = f.id 
  WHERE f.owner_id = _user_id 
    AND b.status IN ('confirmed', 'pending')
    AND b.booking_date >= CURRENT_DATE;
  
  -- If there are active bookings, collect data for email notifications
  IF active_booking_count > 0 THEN
    -- Get facility names for the cancellation email
    SELECT array_agg(DISTINCT f.name) INTO facility_names
    FROM bookings b 
    JOIN facilities f ON b.facility_id = f.id 
    WHERE f.owner_id = _user_id 
      AND b.status IN ('confirmed', 'pending')
      AND b.booking_date >= CURRENT_DATE;
    
    -- Get client emails who have active bookings
    SELECT array_agg(DISTINCT p.email) INTO client_emails
    FROM bookings b 
    JOIN facilities f ON b.facility_id = f.id 
    JOIN profiles p ON b.client_id = p.user_id
    WHERE f.owner_id = _user_id 
      AND b.status IN ('confirmed', 'pending')
      AND b.booking_date >= CURRENT_DATE
      AND p.email IS NOT NULL;
    
    -- Get booking IDs for reference
    SELECT array_agg(b.id) INTO booking_ids
    FROM bookings b 
    JOIN facilities f ON b.facility_id = f.id 
    WHERE f.owner_id = _user_id 
      AND b.status IN ('confirmed', 'pending')
      AND b.booking_date >= CURRENT_DATE;
  END IF;
  
  -- CRITICAL: Update facility information in bookings before marking as cancelled
  -- This preserves facility details for client viewing even after facility deletion
  UPDATE public.bookings 
  SET 
    facility_name = f.name,
    facility_address = f.address,
    status = 'cancelled'::booking_status,
    notes = COALESCE(notes, '') || ' [Anulat automat - proprietarul facilității și-a șters contul]'
  FROM public.facilities f
  WHERE bookings.facility_id = f.id 
    AND f.owner_id = _user_id;
  
  -- Log the action before deletion with metadata about what will be affected
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'delete_user_account',
    _user_id,
    target_email,
    jsonb_build_object(
      'timestamp', now(),
      'facilities_deleted', facility_count,
      'user_bookings_deleted', booking_count,
      'facility_bookings_cancelled', (
        SELECT COUNT(*) FROM bookings b 
        JOIN facilities f ON b.facility_id = f.id 
        WHERE f.owner_id = _user_id
      ),
      'active_bookings_cancelled', active_booking_count,
      'clients_notified', COALESCE(array_length(client_emails, 1), 0)
    )
  );
  
  -- Now safely delete user facilities (bookings are preserved with facility info)
  DELETE FROM public.facilities WHERE owner_id = _user_id;
  
  -- Delete user's own bookings as a client (not facility-related bookings)
  DELETE FROM public.bookings WHERE client_id = _user_id;
  
  -- Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = _user_id;
  
  -- Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = _user_id;
  
  RETURN FOUND;
END;
$function$;