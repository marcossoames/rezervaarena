-- Fix storage policies for facility images by dropping and recreating them
DROP POLICY IF EXISTS "Anyone can view facility images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can update their facility images" ON storage.objects;
DROP POLICY IF EXISTS "Facility owners can delete their facility images" ON storage.objects;

-- Create the correct policies
CREATE POLICY "Facility images public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'facility-images');

CREATE POLICY "Facility images authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Facility images owner update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Facility images owner delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'facility-images' 
  AND auth.uid() IS NOT NULL
);