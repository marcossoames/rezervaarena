-- Create or replace a public-safe function to fetch full facility description
CREATE OR REPLACE FUNCTION public.get_facility_public_details(facility_id_param uuid)
RETURNS TABLE (
  id uuid,
  name text,
  description text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.id, f.name, f.description
  FROM public.facilities f
  WHERE f.id = facility_id_param AND f.is_active = true;
$$;

-- Allow both anonymous and authenticated callers to execute this function
GRANT EXECUTE ON FUNCTION public.get_facility_public_details(uuid) TO anon, authenticated;