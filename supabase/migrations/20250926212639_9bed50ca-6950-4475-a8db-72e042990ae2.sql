-- Fix booking cancellation aggregation and prevent cascading deletions by not deleting auth.users/profiles
-- 1) Update cancel_user_bookings_on_deletion to build a proper JSON array of booking_details
CREATE OR REPLACE FUNCTION public.cancel_user_bookings_on_deletion(user_id_param uuid, user_role text)
RETURNS TABLE(cancelled_bookings_count integer, booking_details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cancellation_reason text;
  today_date date := CURRENT_DATE;
  cancelled_count integer := 0;
  booking_info jsonb := '[]'::jsonb;
  booking_rec record;
BEGIN
  -- Set cancellation reason based on user role
  IF user_role = 'facility_owner' THEN
    cancellation_reason := 'Proprietarul bazei sportive și-a șters contul';
  ELSE
    cancellation_reason := 'Clientul și-a șters contul';
  END IF;

  -- For facility owners: cancel all future bookings on their facilities
  IF user_role = 'facility_owner' THEN
    FOR booking_rec IN 
      SELECT 
        b.id,
        b.client_id,
        b.facility_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.total_price,
        f.name as facility_name,
        p.email as client_email,
        p.full_name as client_name
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      LEFT JOIN profiles p ON b.client_id = p.user_id
      WHERE f.owner_id = user_id_param
        AND b.booking_date >= today_date
        AND b.status IN ('confirmed', 'pending')
    LOOP
      -- Update booking status to cancelled
      UPDATE bookings 
      SET 
        status = 'cancelled'::booking_status,
        notes = COALESCE(notes, '') || 
                CASE WHEN notes IS NOT NULL AND notes != '' 
                     THEN '. ' || cancellation_reason 
                     ELSE cancellation_reason 
                END,
        updated_at = now()
      WHERE id = booking_rec.id;
      
      cancelled_count := cancelled_count + 1;
      
      -- Collect booking details for email sending (append as array element)
      booking_info := booking_info || jsonb_build_array(jsonb_build_object(
        'booking_id', booking_rec.id,
        'client_email', booking_rec.client_email,
        'client_name', booking_rec.client_name,
        'facility_name', booking_rec.facility_name,
        'booking_date', booking_rec.booking_date,
        'start_time', booking_rec.start_time,
        'end_time', booking_rec.end_time,
        'total_price', booking_rec.total_price
      ));
    END LOOP;
  ELSE
    -- For clients: cancel their own future bookings
    FOR booking_rec IN 
      SELECT 
        b.id,
        b.facility_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.total_price,
        f.name as facility_name,
        f.owner_id as facility_owner_id,
        p.email as facility_owner_email,
        p.full_name as facility_owner_name
      FROM bookings b
      JOIN facilities f ON b.facility_id = f.id
      LEFT JOIN profiles p ON f.owner_id = p.user_id
      WHERE b.client_id = user_id_param
        AND b.booking_date >= today_date
        AND b.status IN ('confirmed', 'pending')
    LOOP
      -- Update booking status to cancelled
      UPDATE bookings 
      SET 
        status = 'cancelled'::booking_status,
        notes = COALESCE(notes, '') || 
                CASE WHEN notes IS NOT NULL AND notes != '' 
                     THEN '. ' || cancellation_reason 
                     ELSE cancellation_reason 
                END,
        updated_at = now()
      WHERE id = booking_rec.id;
      
      cancelled_count := cancelled_count + 1;
      
      -- Collect booking details for facility owner notification (append as array element)
      booking_info := booking_info || jsonb_build_array(jsonb_build_object(
        'booking_id', booking_rec.id,
        'facility_owner_email', booking_rec.facility_owner_email,
        'facility_owner_name', booking_rec.facility_owner_name,
        'facility_name', booking_rec.facility_name,
        'booking_date', booking_rec.booking_date,
        'start_time', booking_rec.start_time,
        'end_time', booking_rec.end_time,
        'total_price', booking_rec.total_price
      ));
    END LOOP;
  END IF;

  RETURN QUERY SELECT cancelled_count, booking_info;
END;
$$;

-- 2) Update delete_current_user_account to avoid deleting auth.users/profiles (prevent cascading deletions)
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  user_profile record;
  cancellation_result record;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get user profile information
  SELECT role, email, full_name INTO user_profile
  FROM profiles 
  WHERE user_id = current_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Cancel future bookings instead of deleting them
  SELECT cancelled_bookings_count, booking_details INTO cancellation_result
  FROM cancel_user_bookings_on_deletion(current_user_id, user_profile.role::text);

  -- Deactivate facilities if user is facility owner (don't delete them)
  IF user_profile.role = 'facility_owner' THEN
    UPDATE facilities 
    SET 
      is_active = false,
      updated_at = now()
    WHERE owner_id = current_user_id;
  END IF;

  -- IMPORTANT: Do NOT delete profiles or auth.users to preserve booking history and avoid cascades
  -- Optionally anonymize profile data here if needed (kept minimal per request)
  
  RETURN jsonb_build_object(
    'success', true,
    'cancelled_bookings', cancellation_result.cancelled_bookings_count,
    'booking_details', cancellation_result.booking_details,
    'user_role', user_profile.role,
    'user_email', user_profile.email,
    'user_name', user_profile.full_name
  );
END;
$$;