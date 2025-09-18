-- Create enhanced account deletion function that sends cancellation emails
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_user_id uuid;
  user_profile RECORD;
  affected_bookings RECORD;
  client_emails text[];
  facility_names text[];
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Get user profile
  SELECT email, full_name, role INTO user_profile
  FROM public.profiles 
  WHERE user_id = current_user_id;
  
  -- If this is a facility owner, collect info about bookings that will be cancelled
  IF user_profile.role = 'facility_owner' OR user_profile.role = 'admin' THEN
    -- Get affected client emails and facility names for cancellation notifications
    SELECT 
      ARRAY_AGG(DISTINCT p.email) FILTER (WHERE p.email IS NOT NULL),
      ARRAY_AGG(DISTINCT f.name) FILTER (WHERE f.name IS NOT NULL)
    INTO client_emails, facility_names
    FROM bookings b
    JOIN facilities f ON b.facility_id = f.id
    JOIN profiles p ON b.client_id = p.user_id
    WHERE f.owner_id = current_user_id
      AND b.booking_date >= CURRENT_DATE
      AND b.status IN ('confirmed', 'pending');
      
    -- Send cancellation emails via edge function if there are affected bookings
    IF client_emails IS NOT NULL AND array_length(client_emails, 1) > 0 THEN
      BEGIN
        -- This will be handled by the application layer after deletion
        INSERT INTO public.admin_audit_logs (
          admin_user_id, 
          action, 
          target_user_id, 
          metadata
        ) VALUES (
          current_user_id,
          'facility_owner_deletion_cancellations',
          current_user_id,
          jsonb_build_object(
            'affected_clients', client_emails,
            'facility_names', facility_names,
            'deletion_timestamp', now()
          )
        );
      EXCEPTION WHEN OTHERS THEN
        -- Don't fail deletion if audit log fails
        RAISE WARNING 'Failed to log cancellation data: %', SQLERRM;
      END;
    END IF;
  END IF;
  
  -- Delete user facilities (cascades to related data)
  DELETE FROM public.facilities WHERE owner_id = current_user_id;
  
  -- Delete user bookings
  DELETE FROM public.bookings WHERE client_id = current_user_id;
  
  -- Delete user bank details
  DELETE FROM public.bank_details WHERE user_id = current_user_id;
  
  -- Delete from profiles
  DELETE FROM public.profiles WHERE user_id = current_user_id;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error deleting user account: %', SQLERRM;
END;
$function$;