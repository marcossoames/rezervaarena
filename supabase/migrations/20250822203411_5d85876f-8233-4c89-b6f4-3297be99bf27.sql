-- Fix the registration process by creating a secure function for facility creation

-- First, let's ensure the trigger for profile creation works properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate the user creation trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile with default client role
  INSERT INTO public.profiles (user_id, email, full_name, role, user_type_comment)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    'client'::user_role,
    'Client obișnuit'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create a secure facility registration function that bypasses RLS
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
BEGIN
  -- Update the user's profile to include facility owner information
  UPDATE public.profiles 
  SET 
    full_name = p_full_name,
    phone = p_phone,
    user_type_comment = 'Proprietar bază sportivă - înregistrat prin sistem'
  WHERE user_id = p_user_id;
  
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
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.register_facility_with_profile TO authenticated;