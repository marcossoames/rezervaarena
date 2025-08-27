-- Recreate the final functions that were dropped

CREATE OR REPLACE FUNCTION public.register_facility_with_profile(p_user_id uuid, p_email text, p_full_name text, p_phone text, p_facility_name text, p_description text, p_facility_type facility_type, p_address text, p_city text, p_price_per_hour numeric, p_capacity integer, p_amenities text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  facility_id uuid;
  profile_exists boolean;
BEGIN
  -- Check if profile exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO profile_exists;
  
  -- If profile doesn't exist, create it first
  IF NOT profile_exists THEN
    INSERT INTO public.profiles (user_id, email, full_name, phone, role, user_type_comment)
    VALUES (
      p_user_id,
      p_email,
      p_full_name,
      p_phone,
      'client'::user_role,
      'Proprietar bază sportivă - înregistrat prin sistem'
    );
  ELSE
    -- Update existing profile
    UPDATE public.profiles 
    SET 
      full_name = p_full_name,
      phone = p_phone,
      user_type_comment = 'Proprietar bază sportivă - înregistrat prin sistem'
    WHERE user_id = p_user_id;
  END IF;
  
  -- Create the facility (this bypasses RLS due to SECURITY DEFINER)
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
    p_user_id,
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

CREATE OR REPLACE FUNCTION public.register_facility_with_profile_secure(p_email text, p_full_name text, p_phone text, p_facility_name text, p_description text, p_facility_type facility_type, p_address text, p_city text, p_price_per_hour numeric, p_capacity integer, p_amenities text[])
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