-- First, update all NULL phone values with a placeholder
UPDATE public.profiles 
SET phone = 'Telefon necompletat' 
WHERE phone IS NULL OR phone = '';

-- Now make phone field required
ALTER TABLE public.profiles 
ALTER COLUMN phone SET NOT NULL;

-- Update the handle_new_user function to require phone from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public 
AS $$
BEGIN
  -- Create profile with required phone number
  INSERT INTO public.profiles (user_id, email, full_name, phone, role, user_type_comment)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
      'Telefon necompletat' -- This should not happen with frontend validation
    ),
    COALESCE(
      (NEW.raw_user_meta_data ->> 'role')::user_role,
      'client'::user_role
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'user_type_comment', ''),
      'Client obișnuit'
    )
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    user_type_comment = EXCLUDED.user_type_comment;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;