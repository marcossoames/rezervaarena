-- Fix storage policies for facility-images bucket to prevent unauthorized uploads
-- First, drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload facility images" ON storage.objects;

-- Create secure policies for facility-images bucket
CREATE POLICY "Public read access for facility images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can insert images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can update their images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can delete their images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all facility images" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'facility-images' 
  AND has_role('admin'::user_role)
);

-- Ensure booking integrity triggers are active and not duplicated
-- Drop any existing duplicates first
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
DROP TRIGGER IF EXISTS check_booking_overlap_trigger ON public.bookings;
DROP TRIGGER IF EXISTS validate_booking_security_trigger ON public.bookings;
DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
DROP TRIGGER IF EXISTS update_client_booking_stats_trigger ON public.bookings;

-- Create consolidated booking security trigger
CREATE TRIGGER booking_security_validation_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_security();

-- Create booking overlap prevention trigger
CREATE TRIGGER booking_overlap_prevention_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_booking_overlap();

-- Create booking integrity protection trigger
CREATE TRIGGER booking_integrity_protection_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION protect_booking_integrity();

-- Create client stats update trigger
CREATE TRIGGER client_stats_update_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_client_booking_stats();