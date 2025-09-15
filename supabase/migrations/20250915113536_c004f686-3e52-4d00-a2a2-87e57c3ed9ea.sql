-- Add audit logging for bank details operations
CREATE TABLE IF NOT EXISTS public.bank_details_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID REFERENCES auth.users(id),
  target_user_id UUID NOT NULL,
  bank_details_id UUID,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit logs
ALTER TABLE public.bank_details_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view bank details audit logs" 
ON public.bank_details_audit_logs 
FOR SELECT 
USING (has_role('admin'::user_role));

-- Create secure function for IBAN masking
CREATE OR REPLACE FUNCTION public.mask_iban(iban_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF iban_value IS NULL OR LENGTH(iban_value) < 8 THEN
    RETURN iban_value;
  END IF;
  
  -- Show only first 4 and last 4 characters, mask the middle
  RETURN SUBSTRING(iban_value FROM 1 FOR 4) || 
         REPEAT('*', LENGTH(iban_value) - 8) || 
         SUBSTRING(iban_value FROM LENGTH(iban_value) - 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Create audit trigger for bank details changes
CREATE OR REPLACE FUNCTION public.audit_bank_details_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all bank details operations
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.bank_details_audit_logs (
      admin_user_id, 
      target_user_id, 
      bank_details_id, 
      action, 
      new_data
    ) VALUES (
      auth.uid(),
      NEW.user_id,
      NEW.id,
      'INSERT',
      jsonb_build_object(
        'account_holder_name', NEW.account_holder_name,
        'bank_name', NEW.bank_name,
        'iban_masked', mask_iban(NEW.iban),
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.bank_details_audit_logs (
      admin_user_id, 
      target_user_id, 
      bank_details_id, 
      action, 
      old_data,
      new_data
    ) VALUES (
      auth.uid(),
      NEW.user_id,
      NEW.id,
      'UPDATE',
      jsonb_build_object(
        'account_holder_name', OLD.account_holder_name,
        'bank_name', OLD.bank_name,
        'iban_masked', mask_iban(OLD.iban)
      ),
      jsonb_build_object(
        'account_holder_name', NEW.account_holder_name,
        'bank_name', NEW.bank_name,
        'iban_masked', mask_iban(NEW.iban),
        'timestamp', now()
      )
    );
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.bank_details_audit_logs (
      admin_user_id, 
      target_user_id, 
      bank_details_id, 
      action, 
      old_data
    ) VALUES (
      auth.uid(),
      OLD.user_id,
      OLD.id,
      'DELETE',
      jsonb_build_object(
        'account_holder_name', OLD.account_holder_name,
        'bank_name', OLD.bank_name,
        'iban_masked', mask_iban(OLD.iban),
        'timestamp', now()
      )
    );
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the audit trigger
DROP TRIGGER IF EXISTS bank_details_audit_trigger ON public.bank_details;
CREATE TRIGGER bank_details_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.audit_bank_details_changes();

-- Add additional security validation for bank details
CREATE OR REPLACE FUNCTION public.validate_bank_details_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate IBAN format more strictly
  IF NEW.iban IS NOT NULL THEN
    -- Remove spaces and convert to uppercase for validation
    NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
    
    -- Validate Romanian IBAN format
    IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
      RAISE EXCEPTION 'IBAN format invalid. Must be Romanian IBAN format: RO + 2 digits + 4 letters + 16 alphanumeric characters';
    END IF;
  END IF;
  
  -- Validate account holder name (no special characters that could indicate injection)
  IF NEW.account_holder_name IS NOT NULL THEN
    IF NEW.account_holder_name ~ '[<>"\'';&\(\)]' THEN
      RAISE EXCEPTION 'Account holder name contains invalid characters';
    END IF;
    
    -- Ensure minimum length
    IF LENGTH(TRIM(NEW.account_holder_name)) < 2 THEN
      RAISE EXCEPTION 'Account holder name must be at least 2 characters long';
    END IF;
  END IF;
  
  -- Validate bank name
  IF NEW.bank_name IS NOT NULL THEN
    IF NEW.bank_name ~ '[<>"\'';&\(\)]' THEN
      RAISE EXCEPTION 'Bank name contains invalid characters';
    END IF;
    
    IF LENGTH(TRIM(NEW.bank_name)) < 2 THEN
      RAISE EXCEPTION 'Bank name must be at least 2 characters long';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create validation trigger
DROP TRIGGER IF EXISTS validate_bank_details_trigger ON public.bank_details;
CREATE TRIGGER validate_bank_details_trigger
  BEFORE INSERT OR UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.validate_bank_details_security();

-- Create secure function to get masked bank details for display
CREATE OR REPLACE FUNCTION public.get_masked_bank_details_for_user(user_id_param UUID)
RETURNS TABLE(
  id UUID,
  account_holder_name TEXT,
  bank_name TEXT,
  iban_masked TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Only return data for the authenticated user or admins
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != user_id_param AND NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: can only view your own bank details';
  END IF;
  
  RETURN QUERY
  SELECT 
    bd.id,
    bd.account_holder_name,
    bd.bank_name,
    mask_iban(bd.iban) as iban_masked,
    bd.created_at,
    bd.updated_at
  FROM public.bank_details bd
  WHERE bd.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;