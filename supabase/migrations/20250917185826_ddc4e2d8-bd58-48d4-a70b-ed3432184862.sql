-- Extend handle_new_user to also create facilities from signup metadata (no localStorage needed)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  facilities_json jsonb;
  facility jsonb;
  facility_type_text text;
  amenities_text_array text[];
  city_text text;
  address_text text;
  price_numeric numeric;
  capacity_int integer;
  capacity_max_int integer;
BEGIN
  -- Create or update profile with proper role detection (existing behavior)
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
  
  -- Create facilities from metadata if provided
  facilities_json := NEW.raw_user_meta_data -> 'facilities';
  IF facilities_json IS NOT NULL AND jsonb_typeof(facilities_json) = 'array' THEN
    FOR facility IN SELECT jsonb_array_elements(facilities_json) LOOP
      BEGIN
        facility_type_text := NULLIF(facility->>'facilityType', '');
        city_text := COALESCE(NULLIF(facility->>'city', ''), NULLIF(NEW.raw_user_meta_data->>'city', ''));
        address_text := COALESCE(NULLIF(facility->>'address', ''), NULLIF(NEW.raw_user_meta_data->>'address', ''));
        price_numeric := NULLIF(facility->>'pricePerHour', '')::numeric;
        capacity_int := NULLIF(facility->>'capacity', '')::integer;
        capacity_max_int := NULLIF(facility->>'capacityMax', '')::integer;
        amenities_text_array := (
          SELECT ARRAY(SELECT jsonb_array_elements_text(facility->'amenities'))
        );

        INSERT INTO public.facilities (
          owner_id,
          name,
          description,
          facility_type,
          address,
          city,
          price_per_hour,
          capacity,
          capacity_max,
          amenities,
          is_active
        ) VALUES (
          NEW.id,
          COALESCE(NULLIF(facility->>'name',''), 'Facilitate'),
          NULLIF(facility->>'description',''),
          CASE WHEN facility_type_text IS NOT NULL THEN facility_type_text::facility_type ELSE NULL END,
          address_text,
          city_text,
          price_numeric,
          capacity_int,
          capacity_max_int,
          amenities_text_array,
          true
        );
      EXCEPTION WHEN OTHERS THEN
        -- Don't block user creation if facility insert fails; log warning
        RAISE WARNING 'Failed to create facility for user %: %', NEW.id, SQLERRM;
      END;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block user creation
  RAISE WARNING 'Failed in handle_new_user for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;