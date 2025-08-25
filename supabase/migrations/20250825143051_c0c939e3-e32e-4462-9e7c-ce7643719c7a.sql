-- Update RLS policies for bank_details to allow facility owners to manage their own bank details

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only admins can view bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Only admins can insert bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Only admins can update bank details" ON public.bank_details;

-- Create new policies that allow users to manage their own bank details and admins to see all
CREATE POLICY "Users can view their own bank details" 
ON public.bank_details 
FOR SELECT 
USING (auth.uid() = user_id OR has_role('admin'::user_role));

CREATE POLICY "Users can insert their own bank details" 
ON public.bank_details 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR has_role('admin'::user_role));

CREATE POLICY "Users can update their own bank details" 
ON public.bank_details 
FOR UPDATE 
USING (auth.uid() = user_id OR has_role('admin'::user_role));

CREATE POLICY "Users can delete their own bank details" 
ON public.bank_details 
FOR DELETE 
USING (auth.uid() = user_id OR has_role('admin'::user_role));