-- Update the delete function to ensure proper cascade deletion
CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  target_email text;
  facility_count integer;
  booking_count integer;
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email and count related data before deletion
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  SELECT COUNT(*) INTO facility_count FROM facilities WHERE owner_id = _user_id;
  SELECT COUNT(*) INTO booking_count FROM bookings WHERE client_id = _user_id;
  
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
      'bookings_deleted', booking_count
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
$function$;