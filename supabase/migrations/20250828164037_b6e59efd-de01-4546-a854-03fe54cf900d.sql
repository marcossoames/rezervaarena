-- Fix storage policies for facility-images bucket - drop all existing first
DO $$
DECLARE
    pol_name text;
BEGIN
    -- Drop all existing policies on storage.objects for facility-images bucket
    FOR pol_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
        AND policyname LIKE '%facility%' OR policyname LIKE '%image%'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol_name || '" ON storage.objects';
    END LOOP;
END $$;

-- Create secure policies for facility-images bucket
CREATE POLICY "Public read facility images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners insert images" 
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

CREATE POLICY "Facility owners update images" 
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

CREATE POLICY "Facility owners delete images" 
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

CREATE POLICY "Admins manage facility images" 
ON storage.objects 
FOR ALL 
USING (
  bucket_id = 'facility-images' 
  AND has_role('admin'::user_role)
);

-- Ensure booking integrity triggers are active
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
DROP TRIGGER IF EXISTS check_booking_overlap_trigger ON public.bookings;
DROP TRIGGER IF EXISTS validate_booking_security_trigger ON public.bookings;
DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
DROP TRIGGER IF EXISTS update_client_booking_stats_trigger ON public.bookings;

-- Create booking triggers
CREATE TRIGGER booking_security_validation_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_security();

CREATE TRIGGER booking_overlap_prevention_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_booking_overlap();

CREATE TRIGGER booking_integrity_protection_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION protect_booking_integrity();

CREATE TRIGGER client_stats_update_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_client_booking_stats();