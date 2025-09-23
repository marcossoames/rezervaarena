-- Make facility-images bucket public for direct image access
UPDATE storage.buckets SET public = true WHERE id = 'facility-images';

-- Ensure a public read policy exists for the facility-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Public read for facility-images'
  ) THEN
    CREATE POLICY "Public read for facility-images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'facility-images');
  END IF;
END $$;