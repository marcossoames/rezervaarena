-- Block account deletion if user has active bookings - require manual cancellation first

CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_email text;
  client_active_count integer;
  owner_active_count integer;
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  -- Check for active bookings as a client
  SELECT COUNT(*) INTO client_active_count
  FROM bookings
  WHERE client_id = _user_id
    AND status IN ('confirmed', 'pending')
    AND booking_date >= CURRENT_DATE;

  -- Check for active bookings on owned facilities
  SELECT COUNT(*) INTO owner_active_count
  FROM bookings b
  JOIN facilities f ON b.facility_id = f.id
  WHERE f.owner_id = _user_id
    AND b.status IN ('confirmed', 'pending')
    AND b.booking_date >= CURRENT_DATE;

  -- Block deletion if active bookings exist
  IF client_active_count > 0 OR owner_active_count > 0 THEN
    RAISE EXCEPTION 'ACTIVE_BOOKINGS_EXIST: Nu poți șterge contul cât timp ai rezervări active. Te rugăm să anulezi manual toate rezervările înainte.';
  END IF;

  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;

  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'delete_user_account',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );

  -- Delete facilities and profile
  DELETE FROM public.facilities WHERE owner_id = _user_id;
  DELETE FROM public.bookings WHERE client_id = _user_id;
  DELETE FROM public.profiles WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_user_account_admin(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_ids_array UUID[];
  client_active_count integer;
  owner_active_count integer;
BEGIN
  -- Mark internal op
  PERFORM set_config('app.internal_op', 'true', true);

  -- Check for active bookings as a client
  SELECT COUNT(*) INTO client_active_count
  FROM bookings
  WHERE client_id = user_id_param
    AND status IN ('confirmed', 'pending')
    AND booking_date >= CURRENT_DATE;

  -- Get facilities owned by user
  SELECT ARRAY(SELECT id FROM public.facilities WHERE owner_id = user_id_param) INTO facility_ids_array;

  -- Check for active bookings on owned facilities
  IF array_length(facility_ids_array, 1) > 0 THEN
    SELECT COUNT(*) INTO owner_active_count
    FROM bookings b
    WHERE b.facility_id = ANY(facility_ids_array)
      AND b.status IN ('confirmed', 'pending')
      AND b.booking_date >= CURRENT_DATE;
  ELSE
    owner_active_count := 0;
  END IF;

  -- Block deletion if active bookings exist
  IF client_active_count > 0 OR owner_active_count > 0 THEN
    RAISE EXCEPTION 'ACTIVE_BOOKINGS_EXIST: Nu poți șterge contul cât timp ai rezervări active. Te rugăm să anulezi manual toate rezervările înainte.';
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