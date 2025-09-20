-- Create storage bucket for facility images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('facility-images', 'facility-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for facility images
CREATE POLICY "Facility images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'facility-images');

CREATE POLICY "Authenticated users can upload facility images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Facility owners can update their facility images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Facility owners can delete their facility images"
ON storage.objects FOR DELETE
USING (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);