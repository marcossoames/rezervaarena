-- Allow authenticated users to upload images to the facility-images bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Authenticated can upload facility images'
  ) THEN
    CREATE POLICY "Authenticated can upload facility images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'facility-images');
  END IF;
END $$;

-- Optional: allow owners to update/delete their own uploaded images later (safe but not required now)
-- You can refine path-based ownership later if needed.
