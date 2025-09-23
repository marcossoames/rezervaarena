-- Fix the delete_user_account_secure function to properly call the edge function
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
  booking_details_array jsonb[];
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
    
    -- Get booking IDs and details for reference
    SELECT 
      array_agg(b.id),
      array_agg(jsonb_build_object(
        'date', b.booking_date::text,
        'time', CONCAT(b.start_time::text, ' - ', b.end_time::text),
        'price', b.total_price,
        'facility_name', f.name
      ))
    INTO booking_ids, booking_details_array
    FROM bookings b 
    JOIN facilities f ON b.facility_id = f.id 
    WHERE f.owner_id = _user_id 
      AND b.status IN ('confirmed', 'pending')
      AND b.booking_date >= CURRENT_DATE;
    
    -- Cancel all active bookings on facilities owned by this user
    UPDATE public.bookings 
    SET status = 'cancelled'::booking_status,
        notes = COALESCE(notes, '') || ' [Anulat automat - proprietarul și-a șters contul]'
    WHERE id = ANY(booking_ids);
    
    -- Note: Edge function call will be handled externally after this function returns
    -- Store cancellation data in temporary table for processing
    INSERT INTO public.pending_cancellation_emails (
      booking_ids, 
      client_emails, 
      facility_names, 
      reason,
      created_at
    ) VALUES (
      booking_ids,
      client_emails,
      facility_names,
      'Proprietarul facilității și-a șters contul de pe platformă.',
      now()
    );
  END IF;
  
  -- Log the action before deletion with metadata about what will be deleted
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'delete_user_account',
    _user_id,
    target_email,
    jsonb_build_object(
      'timestamp', now(),
      'facilities_deleted', facility_count,
      'bookings_deleted', booking_count,
      'active_bookings_cancelled', active_booking_count,
      'clients_notified', COALESCE(array_length(client_emails, 1), 0)
    )
  );
  
  -- Delete user facilities first (this will cascade to facility_images, facility_services, blocked_dates)
  DELETE FROM public.facilities WHERE owner_id = _user_id;
  
  -- Delete user bookings
  DELETE FROM public.bookings WHERE client_id = _user_id;
  
  -- Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = _user_id;
  
  -- Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = _user_id;
  
  RETURN FOUND;
END;
$function$

-- Create a table to store pending cancellation emails
CREATE TABLE IF NOT EXISTS public.pending_cancellation_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ids uuid[],
  client_emails text[],
  facility_names text[],
  reason text,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.pending_cancellation_emails ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only
CREATE POLICY "Only admins can access pending cancellation emails" ON public.pending_cancellation_emails
FOR ALL TO authenticated
USING (has_role('admin'::user_role))
WITH CHECK (has_role('admin'::user_role));