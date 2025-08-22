-- Create storage policies for facility owners to upload images
CREATE POLICY "Facility owners can upload their facility images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can view their facility images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'facility-images' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM facilities 
      WHERE id::text = (storage.foldername(name))[1] 
      AND owner_id = auth.uid()
    )
  )
);

CREATE POLICY "Facility owners can update their facility images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can delete their facility images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = (storage.foldername(name))[1] 
    AND owner_id = auth.uid()
  )
);

-- Also allow public access to view facility images
CREATE POLICY "Anyone can view facility images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'facility-images');