-- Fix function signature conflicts and complete security fixes

-- Drop function to avoid signature conflicts
DROP FUNCTION IF EXISTS public.get_facilities_for_booking();

-- Recreate with correct signature
CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, area_info text, description text, price_per_hour numeric, capacity integer, capacity_max integer, amenities text[], images text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Enhanced data for authenticated users - show exact pricing and capacity for booking decisions
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show general area without exact address for security
    f.city || ' area' as area_info,
    -- Show full description for informed decisions
    f.description,
    -- Show exact pricing for booking calculations
    f.price_per_hour,
    -- Show exact capacity for group planning
    f.capacity,
    f.capacity_max,
    -- Show all amenities to highlight facility features
    f.amenities,
    -- Show images for visual decision making
    f.images
  FROM facilities f
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
$function$;

-- Fix remaining functions with search path
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_user_id uuid;
  facility_count integer;
  booking_count integer;
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
  
  -- Don't allow deletion if user has active bookings in the future
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE client_id = current_user_id 
    AND booking_date >= CURRENT_DATE 
    AND status IN ('confirmed', 'pending')
  ) THEN
    RAISE EXCEPTION 'Cannot delete account with future bookings. Please cancel them first.';
  END IF;
  
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
  
  -- Deactivate facilities instead of deleting them (preserve booking history)
  UPDATE public.facilities 
  SET is_active = false, 
      updated_at = now()
  WHERE owner_id = current_user_id;
  
  -- Cancel any pending bookings
  UPDATE public.bookings 
  SET status = 'cancelled',
      notes = COALESCE(notes, '') || ' - Cancelled due to account deletion',
      updated_at = now()
  WHERE client_id = current_user_id 
  AND status = 'pending';
  
  -- Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = current_user_id;
  
  -- Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = current_user_id;
  
  RETURN true;
END;
$function$;

-- Fix remaining security functions
CREATE OR REPLACE FUNCTION public.get_client_info_for_facility_bookings(facility_owner_id uuid)
RETURNS TABLE(client_id uuid, client_name text, client_phone text, client_email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Only return client contact info for bookings on facilities owned by the requesting user
  SELECT DISTINCT 
    b.client_id,
    COALESCE(p.full_name, 'Nume necunoscut') as client_name,
    COALESCE(p.phone, 'Telefon necunoscut') as client_phone,
    COALESCE(p.email, 'Email necunoscut') as client_email
  FROM bookings b
  JOIN facilities f ON b.facility_id = f.id
  LEFT JOIN profiles p ON b.client_id = p.user_id
  WHERE f.owner_id = facility_owner_id
    AND f.owner_id = auth.uid(); -- Double check that the authenticated user is the facility owner
$function$;

CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Check for overlapping bookings on the same facility and date
  IF EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE facility_id = NEW.facility_id 
      AND booking_date = NEW.booking_date
      AND status IN ('confirmed', 'pending')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Booking time overlaps with existing booking';
  END IF;
  
  RETURN NEW;
END;
$function$;