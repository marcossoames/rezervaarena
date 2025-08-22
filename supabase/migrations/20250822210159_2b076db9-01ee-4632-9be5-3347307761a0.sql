-- Update user role to facility_owner and make storage bucket public
UPDATE profiles 
SET role = 'facility_owner'::user_role 
WHERE user_type_comment LIKE '%Proprietar bază sportivă%'
AND role = 'client'::user_role;

-- Make the facility-images bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'facility-images';