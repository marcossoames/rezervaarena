-- Create public bucket for facility images if not exists
insert into storage.buckets (id, name, public)
values ('facility-images', 'facility-images', true)
on conflict (id) do nothing;

-- Public read policy for facility images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Public can view facility images'
  ) THEN
    CREATE POLICY "Public can view facility images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'facility-images');
  END IF;
END $$;

-- Allow facility owners to insert images only into their facility folder (facilityId/filename)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Facility owners can upload images to their facility folder'
  ) THEN
    CREATE POLICY "Facility owners can upload images to their facility folder"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'facility-images' AND
      EXISTS (
        SELECT 1 FROM public.facilities f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Allow facility owners to update their images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Facility owners can update their images'
  ) THEN
    CREATE POLICY "Facility owners can update their images"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'facility-images' AND
      EXISTS (
        SELECT 1 FROM public.facilities f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_id = auth.uid()
      )
    )
    WITH CHECK (
      bucket_id = 'facility-images' AND
      EXISTS (
        SELECT 1 FROM public.facilities f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Allow facility owners to delete their images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Facility owners can delete their images'
  ) THEN
    CREATE POLICY "Facility owners can delete their images"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'facility-images' AND
      EXISTS (
        SELECT 1 FROM public.facilities f
        WHERE f.id::text = (storage.foldername(name))[1]
          AND f.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Drop and recreate the function with improved return data
DROP FUNCTION public.get_facilities_for_public_browsing_safe() CASCADE;

CREATE OR REPLACE FUNCTION public.get_facilities_for_public_browsing_safe()
RETURNS TABLE(
  id uuid,
  name text,
  facility_type facility_type,
  city text,
  address text,
  description text,
  price_per_hour numeric,
  capacity integer,
  capacity_max integer,
  images text[],
  main_image_url text,
  sports_complex_name text,
  sports_complex_address text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    f.address,
    f.description,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.images,
    f.main_image_url,
    CASE 
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
        THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
      WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
        THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
      ELSE 'Baza Sportivă - ' || f.city
    END AS sports_complex_name,
    f.address AS sports_complex_address,
    f.created_at
  FROM public.facilities f
  JOIN public.profiles p ON p.user_id = f.owner_id
  WHERE f.is_active = true
  ORDER BY f.created_at DESC;
END;
$$;