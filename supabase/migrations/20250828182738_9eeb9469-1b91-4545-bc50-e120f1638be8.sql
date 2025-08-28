-- Fix critical security issues

-- 1. Attach missing booking integrity triggers (they exist but aren't attached)
DROP TRIGGER IF EXISTS booking_overlap_trigger ON public.bookings;
DROP TRIGGER IF EXISTS booking_validation_trigger ON public.bookings;
DROP TRIGGER IF EXISTS booking_protection_trigger ON public.bookings;

CREATE TRIGGER booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.check_booking_overlap();

CREATE TRIGGER booking_validation_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER booking_protection_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_integrity();

-- 2. Add secure storage policies for facility-images bucket
-- Delete existing overly permissive policies if they exist
DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;

-- Create secure policies for facility-images bucket
CREATE POLICY "Facility owners can upload images to their folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'facility-images' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.facilities 
    WHERE owner_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Facility owners can update their images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'facility-images' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.facilities 
    WHERE owner_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Facility owners can delete their images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'facility-images' AND
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.facilities 
    WHERE owner_id = auth.uid() 
    AND id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Public can view facility images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'facility-images');

-- 3. Create secure function for payment verification without PII exposure
CREATE OR REPLACE FUNCTION public.get_facility_for_payment_secure(facility_id_param uuid)
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  price_per_hour numeric,
  capacity integer,
  amenities text[],
  images text[],
  owner_id uuid,
  sports_complex_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data for authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.price_per_hour,
    f.capacity,
    f.amenities,
    f.images,
    f.owner_id,
    -- Sports complex name without exposing personal info
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
  WHERE f.id = facility_id_param 
    AND f.is_active = true;
END;
$$;