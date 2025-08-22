-- Create storage bucket for facility images
INSERT INTO storage.buckets (id, name, public) VALUES ('facility-images', 'facility-images', true);

-- Create storage policies for facility images
CREATE POLICY "Facility owners can upload images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role('facility_owner'::user_role)
);

CREATE POLICY "Everyone can view facility images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');

CREATE POLICY "Facility owners can update their images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role('facility_owner'::user_role)
);

CREATE POLICY "Facility owners can delete their images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'facility-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND has_role('facility_owner'::user_role)
);

-- Add main_image_url column to facilities table
ALTER TABLE facilities ADD COLUMN main_image_url TEXT;