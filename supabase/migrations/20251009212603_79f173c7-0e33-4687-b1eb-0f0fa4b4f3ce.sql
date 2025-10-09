-- Ensure cancellation emails are queued when deleting accounts

-- 1) Update secure admin deletion function to queue emails for clients with future bookings on owner's facilities
CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Gather metadata
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  SELECT COUNT(*) INTO facility_count FROM facilities WHERE owner_id = _user_id;
  SELECT COUNT(*) INTO booking_count FROM bookings WHERE client_id = _user_id;

  -- Collect active bookings on owner's facilities
  SELECT array_agg(DISTINCT f.name) INTO facility_names
  FROM bookings b 
  JOIN facilities f ON b.facility_id = f.id 
  WHERE f.owner_id = _user_id 
    AND b.status IN ('confirmed', 'pending')
    AND b.booking_date >= CURRENT_DATE;

  SELECT array_agg(DISTINCT p.email) INTO client_emails
  FROM bookings b 
  JOIN facilities f ON b.facility_id = f.id 
  JOIN profiles p ON b.client_id = p.user_id
  WHERE f.owner_id = _user_id 
    AND b.status IN ('confirmed', 'pending')
    AND b.booking_date >= CURRENT_DATE
    AND p.email IS NOT NULL;

  SELECT array_agg(b.id) INTO booking_ids
  FROM bookings b 
  JOIN facilities f ON b.facility_id = f.id 
  WHERE f.owner_id = _user_id 
    AND b.status IN ('confirmed', 'pending')
    AND b.booking_date >= CURRENT_DATE;

  SELECT COALESCE(array_length(booking_ids,1),0) INTO active_booking_count;

  -- Cancel bookings on owner's facilities but preserve facility info
  UPDATE public.bookings 
  SET 
    facility_name = f.name,
    facility_address = f.address,
    status = 'cancelled'::booking_status,
    notes = COALESCE(notes, '') || ' [Anulat automat - ștergere cont proprietar]'
  FROM public.facilities f
  WHERE bookings.facility_id = f.id 
    AND f.owner_id = _user_id;

  -- Queue cancellation emails for affected clients
  IF active_booking_count > 0 AND client_emails IS NOT NULL AND array_length(client_emails,1) > 0 THEN
    INSERT INTO public.pending_cancellation_emails (booking_ids, client_emails, facility_names, reason, processed)
    VALUES (booking_ids, client_emails, facility_names, 'Anulări automate - proprietarul facilității și-a șters contul', false);
  END IF;

  -- Log
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
      'active_bookings_cancelled', active_booking_count,
      'clients_queued_for_notification', COALESCE(array_length(client_emails, 1), 0)
    )
  );

  -- Delete facilities and profile (bookings preserved as cancelled)
  DELETE FROM public.facilities WHERE owner_id = _user_id;
  DELETE FROM public.bookings WHERE client_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN FOUND;
END;
$$;

-- 2) Update admin deletion function (used by edge function) to queue emails similarly
CREATE OR REPLACE FUNCTION public.delete_user_account_admin(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_ids_array UUID[];
  facility_names text[];
  client_emails text[];
  booking_ids uuid[];
  active_booking_count integer;
BEGIN
  -- Mark internal op
  PERFORM set_config('app.internal_op', 'true', true);

  -- Facilities owned by user
  SELECT ARRAY(SELECT id FROM public.facilities WHERE owner_id = user_id_param) INTO facility_ids_array;

  IF array_length(facility_ids_array,1) > 0 THEN
    -- Collect data for notifications (future active bookings on owned facilities)
    SELECT array_agg(DISTINCT f.name) INTO facility_names
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    WHERE f.owner_id = user_id_param
      AND b.status IN ('confirmed','pending')
      AND b.booking_date >= CURRENT_DATE;

    SELECT array_agg(DISTINCT p.email) INTO client_emails
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN profiles p ON b.client_id = p.user_id
    WHERE f.owner_id = user_id_param
      AND b.status IN ('confirmed','pending')
      AND b.booking_date >= CURRENT_DATE
      AND p.email IS NOT NULL;

    SELECT array_agg(b.id) INTO booking_ids
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    WHERE f.owner_id = user_id_param
      AND b.status IN ('confirmed','pending')
      AND b.booking_date >= CURRENT_DATE;

    SELECT COALESCE(array_length(booking_ids,1),0) INTO active_booking_count;

    -- Cancel bookings on owned facilities (preserve info)
    UPDATE public.bookings b
    SET 
      facility_name = f.name,
      facility_address = f.address,
      status = 'cancelled'::booking_status,
      notes = COALESCE(b.notes, '') || ' [Anulat automat - ștergere cont proprietar]'
    FROM public.facilities f
    WHERE b.facility_id = f.id AND f.owner_id = user_id_param;

    -- Queue cancellation emails
    IF active_booking_count > 0 AND client_emails IS NOT NULL AND array_length(client_emails,1) > 0 THEN
      INSERT INTO public.pending_cancellation_emails (booking_ids, client_emails, facility_names, reason, processed)
      VALUES (booking_ids, client_emails, facility_names, 'Anulări automate - proprietarul facilității și-a șters contul', false);
    END IF;
  END IF;

  -- Platform payments
  DELETE FROM public.platform_payments WHERE client_id = user_id_param OR facility_owner_id = user_id_param;

  -- Facility-related data
  IF array_length(facility_ids_array, 1) > 0 THEN
    DELETE FROM public.facility_services WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facility_images WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.recurring_blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facilities WHERE owner_id = user_id_param;
    DELETE FROM public.sports_complexes WHERE owner_id = user_id_param;
  END IF;

  -- Bank details
  DELETE FROM public.bank_details WHERE user_id = user_id_param;

  -- Profile
  DELETE FROM public.profiles WHERE user_id = user_id_param;

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error during account deletion: %', SQLERRM;
END;
$$;