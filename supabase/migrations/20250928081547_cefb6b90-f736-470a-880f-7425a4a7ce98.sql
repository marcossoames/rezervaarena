-- Create function to delete user account bypassing RLS
CREATE OR REPLACE FUNCTION public.delete_user_account_admin(user_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_ids_array UUID[];
BEGIN
  -- Get facility IDs owned by this user
  SELECT ARRAY(SELECT id FROM public.facilities WHERE owner_id = user_id_param) INTO facility_ids_array;
  
  -- Delete all bookings by this user
  DELETE FROM public.bookings WHERE client_id = user_id_param;
  
  -- Delete all bookings for facilities owned by this user
  IF array_length(facility_ids_array, 1) > 0 THEN
    DELETE FROM public.bookings WHERE facility_id = ANY(facility_ids_array);
  END IF;
  
  -- Delete platform payments
  DELETE FROM public.platform_payments WHERE client_id = user_id_param OR facility_owner_id = user_id_param;
  
  -- Delete facility-related data
  IF array_length(facility_ids_array, 1) > 0 THEN
    DELETE FROM public.facility_services WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facility_images WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.recurring_blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facilities WHERE owner_id = user_id_param;
    DELETE FROM public.sports_complexes WHERE owner_id = user_id_param;
  END IF;
  
  -- Delete bank details
  DELETE FROM public.bank_details WHERE user_id = user_id_param;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = user_id_param;
  
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error during account deletion: %', SQLERRM;
END;
$$;