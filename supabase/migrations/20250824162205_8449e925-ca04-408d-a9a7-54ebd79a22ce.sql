-- Fix CRITICAL security issues

-- 1. Create a safe public browsing function that doesn't expose PII
CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, description text, price_per_hour numeric, capacity integer, amenities text[], images text[], sports_complex_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Safe public data without PII exposure
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.amenities,
    f.images,
    -- Safe sports complex name without personal info
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END as sports_complex_name
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
$function$;

-- 2. Create a safe authenticated user function with contact info
CREATE OR REPLACE FUNCTION public.get_facilities_for_authenticated_users()
 RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, area_info text, description text, price_per_hour numeric, capacity integer, amenities text[], images text[], sports_complex_name text, sports_complex_address text, phone_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Enhanced data for authenticated users only
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.city || ' area' as area_info,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.amenities,
    f.images,
    -- Sports complex name
    CASE 
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL 
        AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă ' || SPLIT_PART(p.full_name, ' ', 1) || ' - ' || f.city
    END as sports_complex_name,
    -- Full address and contact info for authenticated users
    f.address || ', ' || f.city as sports_complex_address,
    p.phone as phone_number
  FROM facilities f
  JOIN profiles p ON f.owner_id = p.user_id
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
$function$;

-- 3. Fix the insecure register_facility_with_profile function
CREATE OR REPLACE FUNCTION public.register_facility_with_profile_secure(
  p_email text, 
  p_full_name text, 
  p_phone text, 
  p_facility_name text, 
  p_description text, 
  p_facility_type facility_type, 
  p_address text, 
  p_city text, 
  p_price_per_hour numeric, 
  p_capacity integer, 
  p_amenities text[]
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  facility_id uuid;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user ID
  current_user_id := auth.uid();
  
  -- Ensure user is authenticated
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  -- Verify email matches authenticated user
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = current_user_id 
    AND email = p_email
  ) THEN
    RAISE EXCEPTION 'Email does not match authenticated user';
  END IF;
  
  -- Update user profile (only for current user)
  INSERT INTO public.profiles (user_id, email, full_name, phone, role, user_type_comment)
  VALUES (
    current_user_id,
    p_email,
    p_full_name,
    p_phone,
    'client'::user_role,
    p_facility_name || ' - Proprietar bază sportivă'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    user_type_comment = EXCLUDED.user_type_comment;
  
  -- Create the facility
  INSERT INTO public.facilities (
    owner_id,
    name,
    description,
    facility_type,
    address,
    city,
    price_per_hour,
    capacity,
    amenities,
    is_active
  ) VALUES (
    current_user_id,
    p_facility_name,
    p_description,
    p_facility_type,
    p_address,
    p_city,
    p_price_per_hour,
    p_capacity,
    p_amenities,
    true
  ) RETURNING id INTO facility_id;
  
  RETURN facility_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating facility: %', SQLERRM;
END;
$function$;

-- 4. Create a secure delete user account function
CREATE OR REPLACE FUNCTION public.delete_current_user_account()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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