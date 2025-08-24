-- Critical Security Fixes Migration (Fixed)

-- 1. CRITICAL: Add booking overlap prevention trigger
-- First drop existing trigger if exists
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;

-- Create the trigger function for preventing booking overlaps
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Create the trigger
CREATE TRIGGER prevent_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_booking_overlap();

-- 2. CRITICAL: Fix role self-assignment vulnerability
-- Update profiles RLS policy to prevent role escalation
DROP POLICY IF EXISTS "Users can update their own profile with role restrictions" ON public.profiles;

CREATE POLICY "Users can update their own profile with role restrictions"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = ( 
    SELECT p.role 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    LIMIT 1
  )
);

-- 3. CRITICAL: Fix storage bucket security policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow everyone to view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Allow facility owners to delete images" ON storage.objects;
DROP POLICY IF EXISTS "Allow facility owners to update images" ON storage.objects;

-- Create secure storage policies for facility-images bucket
CREATE POLICY "Facility owners can upload images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Anyone can view facility images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can update their images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Facility owners can delete their images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

-- 4. MEDIUM: Create safe public browsing function (replaces vulnerable one)
CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE(
  id uuid, 
  name text, 
  facility_type facility_type, 
  city text, 
  description text, 
  price_per_hour numeric, 
  capacity integer, 
  amenities text[], 
  images text[], 
  sports_complex_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;