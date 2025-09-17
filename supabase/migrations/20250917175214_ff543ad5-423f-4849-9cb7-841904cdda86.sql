-- Update the handle_new_user function to properly handle facility owner role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create profile with proper role detection
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
      'Telefon necompletat'
    ),
    -- Enhanced role detection: check both explicit role and business_name presence
    CASE 
      WHEN (NEW.raw_user_meta_data ->> 'role') = 'facility_owner' THEN 'facility_owner'::user_role
      WHEN NEW.raw_user_meta_data ->> 'business_name' IS NOT NULL THEN 'facility_owner'::user_role
      ELSE 'client'::user_role
    END,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'user_type_comment', ''),
      CASE 
        WHEN NEW.raw_user_meta_data ->> 'business_name' IS NOT NULL 
        THEN CONCAT(NEW.raw_user_meta_data ->> 'business_name', ' - Proprietar bază sportivă')
        ELSE 'Client obișnuit'
      END
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