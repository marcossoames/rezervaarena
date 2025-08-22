-- Create a policy that allows anonymous users to see basic facility info without owner details
-- We'll handle this in the application code by only selecting specific columns
CREATE POLICY "Public can view basic facility info without owner details" 
ON public.facilities 
FOR SELECT 
USING (is_active = true);