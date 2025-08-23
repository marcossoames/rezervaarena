-- Drop the conflicting policies for facilities UPDATE/DELETE that only allow owners
DROP POLICY IF EXISTS "Facility owners can update their facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can delete their facilities" ON public.facilities;

-- Recreate policies with proper admin access
CREATE POLICY "Facility owners and admins can update facilities" 
ON public.facilities 
FOR UPDATE 
USING (auth.uid() = owner_id OR has_role('admin'::user_role));

CREATE POLICY "Facility owners and admins can delete facilities" 
ON public.facilities 
FOR DELETE 
USING (auth.uid() = owner_id OR has_role('admin'::user_role));

-- Also update the SELECT policy to ensure admins can view all facilities
DROP POLICY IF EXISTS "Facility owners can view their own facilities" ON public.facilities;

CREATE POLICY "Facility owners and admins can view their facilities" 
ON public.facilities 
FOR SELECT 
USING (owner_id = auth.uid() OR has_role('admin'::user_role) OR is_active = true);