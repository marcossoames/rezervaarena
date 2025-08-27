-- Fix Critical Security Issues (Part 2)

-- 1. Fix existing RLS policies for facilities (drop and recreate)
DROP POLICY IF EXISTS "Facility owners can view their own facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can view all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;

-- Create new secure RLS policies for facilities
CREATE POLICY "Facility owners can view their own facilities" 
ON public.facilities 
FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all facilities" 
ON public.facilities 
FOR SELECT 
USING (has_role('admin'::user_role));

CREATE POLICY "Authenticated users can create facilities" 
ON public.facilities 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id AND auth.uid() IS NOT NULL);

-- 2. Add missing database triggers for booking integrity (only if they don't exist)
DO $$
BEGIN
  -- Check and create triggers only if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_validate_booking_security') THEN
    CREATE TRIGGER trigger_validate_booking_security
      BEFORE INSERT OR UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.validate_booking_security();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_prevent_booking_overlap') THEN
    CREATE TRIGGER trigger_prevent_booking_overlap
      BEFORE INSERT OR UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_protect_booking_integrity') THEN
    CREATE TRIGGER trigger_protect_booking_integrity
      BEFORE UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.protect_booking_integrity();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_booking_updated_at') THEN
    CREATE TRIGGER trigger_update_booking_updated_at
      BEFORE UPDATE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_client_booking_stats') THEN
    CREATE TRIGGER trigger_update_client_booking_stats
      AFTER INSERT OR UPDATE OR DELETE ON public.bookings
      FOR EACH ROW EXECUTE FUNCTION public.update_client_booking_stats();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_facility_updated_at') THEN
    CREATE TRIGGER trigger_update_facility_updated_at
      BEFORE UPDATE ON public.facilities
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3. Add storage policies for facility-images bucket (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can upload to their own facility images'
  ) THEN
    CREATE POLICY "Users can upload to their own facility images"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update their own facility images'
  ) THEN
    CREATE POLICY "Users can update their own facility images"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'facility-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own facility images'
  ) THEN
    CREATE POLICY "Users can delete their own facility images"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'facility-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view facility images'
  ) THEN
    CREATE POLICY "Anyone can view facility images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'facility-images');
  END IF;
END $$;