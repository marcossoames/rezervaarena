-- Drop all existing storage policies for facility-images
DROP POLICY IF EXISTS "Facility owners can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update images" ON storage.objects;
DROP POLICY IF EXISTS "facility_images_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "facility_images_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "facility_images_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "facility_images_delete_policy" ON storage.objects;

-- Create simple and effective storage policies for facility images
CREATE POLICY "Allow facility owners to insert images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow everyone to view facility images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'facility-images');

CREATE POLICY "Allow facility owners to update images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'facility-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow facility owners to delete images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'facility-images' 
  AND auth.role() = 'authenticated'
);