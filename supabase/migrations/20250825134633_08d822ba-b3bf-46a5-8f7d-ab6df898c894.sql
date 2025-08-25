-- Create separate table for sensitive bank details
CREATE TABLE public.bank_details (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  account_holder_name text,
  iban text,
  bank_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_details ENABLE ROW LEVEL SECURITY;

-- Only admins can access bank details
CREATE POLICY "Only admins can view bank details" 
ON public.bank_details 
FOR SELECT 
USING (has_role('admin'::user_role));

CREATE POLICY "Only admins can insert bank details" 
ON public.bank_details 
FOR INSERT 
WITH CHECK (has_role('admin'::user_role));

CREATE POLICY "Only admins can update bank details" 
ON public.bank_details 
FOR UPDATE 
USING (has_role('admin'::user_role));

-- Migrate existing data from profiles table
INSERT INTO public.bank_details (user_id, account_holder_name, iban, bank_name)
SELECT user_id, account_holder_name, iban, bank_name
FROM public.profiles
WHERE account_holder_name IS NOT NULL OR iban IS NOT NULL OR bank_name IS NOT NULL;

-- Remove sensitive columns from profiles table  
ALTER TABLE public.profiles DROP COLUMN IF EXISTS account_holder_name;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS iban;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS bank_name;

-- Add trigger for updated_at
CREATE TRIGGER update_bank_details_updated_at
BEFORE UPDATE ON public.bank_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();