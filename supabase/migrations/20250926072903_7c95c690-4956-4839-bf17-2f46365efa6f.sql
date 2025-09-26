-- Create a sports_complexes table to separate complex-level data from facility-level data
CREATE TABLE IF NOT EXISTS public.sports_complexes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  address TEXT,
  city TEXT,
  general_services TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(owner_id) -- One sports complex per owner
);

-- Enable RLS
ALTER TABLE public.sports_complexes ENABLE ROW LEVEL SECURITY;

-- Create policies for sports complexes
CREATE POLICY "Sports complex owners can manage their own complex"
ON public.sports_complexes
FOR ALL
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Authenticated admins can manage all sports complexes"
ON public.sports_complexes
FOR ALL
USING ((auth.uid() IS NOT NULL) AND has_role('admin'::user_role))
WITH CHECK ((auth.uid() IS NOT NULL) AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can view active sports complexes"
ON public.sports_complexes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_sports_complexes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sports_complexes_updated_at
  BEFORE UPDATE ON public.sports_complexes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sports_complexes_updated_at();

-- Migrate existing data from facilities to sports_complexes
-- Extract sports complex data from the first facility of each owner
INSERT INTO public.sports_complexes (owner_id, name, description, address, city, general_services)
SELECT DISTINCT ON (f.owner_id)
  f.owner_id,
  CASE 
    WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '.+ - Proprietar bază sportivă$'
      THEN REGEXP_REPLACE(p.user_type_comment, ' - Proprietar bază sportivă$', '')
    WHEN p.user_type_comment IS NOT NULL AND p.user_type_comment ~ '^Proprietar bază sportivă - .+'
      THEN REGEXP_REPLACE(p.user_type_comment, '^Proprietar bază sportivă - ', '')
    ELSE COALESCE(p.full_name, 'Baza Sportivă - ' || f.city)
  END AS name,
  f.description AS description,
  f.address,
  f.city,
  COALESCE(f.amenities, '{}') AS general_services
FROM public.facilities f
JOIN public.profiles p ON p.user_id = f.owner_id
WHERE f.is_active = true
ORDER BY f.owner_id, f.created_at
ON CONFLICT (owner_id) DO NOTHING;

-- Create function to get sports complex with facilities for display
CREATE OR REPLACE FUNCTION public.get_sports_complex_with_facilities(owner_id_param UUID)
RETURNS TABLE(
  complex_id UUID,
  complex_name TEXT,
  complex_description TEXT,
  complex_address TEXT,
  complex_city TEXT,
  general_services TEXT[],
  facility_id UUID,
  facility_name TEXT,
  facility_description TEXT,
  facility_type facility_type,
  facility_amenities TEXT[],
  price_per_hour NUMERIC,
  capacity INTEGER,
  capacity_max INTEGER,
  operating_hours_start TIME,
  operating_hours_end TIME,
  images TEXT[],
  main_image_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only return data for the authenticated user or admins
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != owner_id_param AND NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: can only view your own sports complex';
  END IF;

  RETURN QUERY
  SELECT 
    sc.id AS complex_id,
    sc.name AS complex_name,
    sc.description AS complex_description,
    sc.address AS complex_address,
    sc.city AS complex_city,
    sc.general_services,
    f.id AS facility_id,
    f.name AS facility_name,
    f.description AS facility_description,
    f.facility_type,
    f.amenities AS facility_amenities,
    f.price_per_hour,
    f.capacity,
    f.capacity_max,
    f.operating_hours_start,
    f.operating_hours_end,
    f.images,
    f.main_image_url
  FROM public.sports_complexes sc
  LEFT JOIN public.facilities f ON f.owner_id = sc.owner_id AND f.is_active = true
  WHERE sc.owner_id = owner_id_param
  ORDER BY f.created_at;
END;
$$;