-- Fix the secure function to ensure profile exists before creating facility
CREATE OR REPLACE FUNCTION public.register_facility_with_profile(
  p_user_id uuid,
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
SET search_path = public
AS $$
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
$$;