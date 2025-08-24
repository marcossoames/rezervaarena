-- Fix CRITICAL: Stripe Payment Underpayment - Server-side price validation
-- Update create-payment Edge Function to validate prices server-side

-- Fix HIGH: Double-Booking Prevention - Add trigger to prevent overlapping bookings  
CREATE OR REPLACE FUNCTION prevent_booking_overlap()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for booking overlap prevention
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
CREATE TRIGGER prevent_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_booking_overlap();

-- Fix HIGH: PII Exposure - Replace public RPC with safe version
DROP FUNCTION IF EXISTS public.get_facilities_for_public_browsing();

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

-- Fix MEDIUM: Role Self-Assignment - Update RLS policy to prevent role escalation
DROP POLICY IF EXISTS "Users can update their own profile with role restrictions" ON public.profiles;

CREATE POLICY "Users can update their own profile with role restrictions"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (
    -- Users cannot change their role at all - only admins can
    role = (SELECT p.role FROM profiles p WHERE p.user_id = auth.uid() LIMIT 1)
  )
);

-- Fix storage bucket policies - Ensure proper access control
DO $$
BEGIN
  -- Update storage policies for facility-images bucket
  DROP POLICY IF EXISTS "Authenticated users can upload facility images" ON storage.objects;
  DROP POLICY IF EXISTS "Public can view facility images" ON storage.objects;
  
  -- Only facility owners can upload to their own folder structure
  CREATE POLICY "Facility owners can upload images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'facility-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
  
  -- Anyone can view facility images (public bucket)
  CREATE POLICY "Anyone can view facility images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'facility-images');
  
  -- Only facility owners can update their images
  CREATE POLICY "Facility owners can update their images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'facility-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
  
  -- Only facility owners can delete their images
  CREATE POLICY "Facility owners can delete their images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'facility-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
END
$$;