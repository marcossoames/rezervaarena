-- Drop existing storage policies and recreate them properly
DROP POLICY IF EXISTS "Facility owners can upload their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can view their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view facility images" ON storage.objects;

-- Create proper storage policies for facility images
CREATE POLICY "Facility owners can upload images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = split_part(name, '/', 1)
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Public can view facility images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can delete images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = split_part(name, '/', 1)
    AND owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can update images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM facilities 
    WHERE id::text = split_part(name, '/', 1)
    AND owner_id = auth.uid()
  )
);