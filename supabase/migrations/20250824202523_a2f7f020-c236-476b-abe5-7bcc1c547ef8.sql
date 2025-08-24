-- Update the secure function to also return client email addresses
CREATE OR REPLACE FUNCTION get_client_info_for_facility_bookings(facility_owner_id uuid)
RETURNS TABLE(
  client_id uuid,
  client_name text,
  client_phone text,
  client_email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only return client contact info for bookings on facilities owned by the requesting user
  SELECT DISTINCT 
    b.client_id,
    COALESCE(p.full_name, 'Nume necunoscut') as client_name,
    COALESCE(p.phone, 'Telefon necunoscut') as client_phone,
    COALESCE(p.email, 'Email necunoscut') as client_email
  FROM bookings b
  JOIN facilities f ON b.facility_id = f.id
  LEFT JOIN profiles p ON b.client_id = p.user_id
  WHERE f.owner_id = facility_owner_id
    AND f.owner_id = auth.uid(); -- Double check that the authenticated user is the facility owner
$$;