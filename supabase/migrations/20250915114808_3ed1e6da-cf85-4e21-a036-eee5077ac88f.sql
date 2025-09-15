-- Create enhanced banking activity log table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS public.banking_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on banking activity log
ALTER TABLE public.banking_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view banking activity logs
CREATE POLICY "Only admins can view banking activity logs"
ON public.banking_activity_log 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- Create index for performance
CREATE INDEX idx_banking_activity_user_time ON public.banking_activity_log(user_id, created_at DESC);
CREATE INDEX idx_banking_activity_ip_time ON public.banking_activity_log(ip_address, created_at DESC);

-- Add additional constraints to existing bank_details table for enhanced security
ALTER TABLE public.bank_details ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now();
ALTER TABLE public.bank_details ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Create function to update access tracking
CREATE OR REPLACE FUNCTION public.track_bank_details_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Update access tracking on SELECT operations
  IF TG_OP = 'UPDATE' AND OLD.last_accessed_at != NEW.last_accessed_at THEN
    NEW.access_count := OLD.access_count + 1;
    NEW.last_accessed_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for access tracking
DROP TRIGGER IF EXISTS track_bank_access_trigger ON public.bank_details;
CREATE TRIGGER track_bank_access_trigger
  BEFORE UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.track_bank_details_access();

-- Enhanced security function to validate banking operations
CREATE OR REPLACE FUNCTION public.validate_banking_operation_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure all banking operations have proper authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for banking operations';
  END IF;
  
  -- Additional validation for sensitive fields
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    -- Validate IBAN format more strictly
    IF NEW.iban IS NOT NULL THEN
      NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
      IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
        RAISE EXCEPTION 'Invalid Romanian IBAN format: %', NEW.iban;
      END IF;
    END IF;
    
    -- Prevent dangerous characters in all text fields
    IF NEW.account_holder_name IS NOT NULL AND NEW.account_holder_name ~ '[<>"\'';&\(\)]' THEN
      RAISE EXCEPTION 'Account holder name contains invalid characters';
    END IF;
    
    IF NEW.bank_name IS NOT NULL AND NEW.bank_name ~ '[<>"\'';&\(\)]' THEN
      RAISE EXCEPTION 'Bank name contains invalid characters';
    END IF;
    
    -- Ensure minimum lengths
    IF LENGTH(TRIM(COALESCE(NEW.account_holder_name, ''))) < 2 THEN
      RAISE EXCEPTION 'Account holder name must be at least 2 characters';
    END IF;
    
    IF LENGTH(TRIM(COALESCE(NEW.bank_name, ''))) < 2 THEN
      RAISE EXCEPTION 'Bank name must be at least 2 characters';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply enhanced security trigger to bank_details
DROP TRIGGER IF EXISTS validate_banking_operation_trigger ON public.bank_details;
CREATE TRIGGER validate_banking_operation_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION public.validate_banking_operation_security();

-- Create function for secure banking data access logging
CREATE OR REPLACE FUNCTION public.log_banking_data_access(operation_type TEXT)
RETURNS VOID AS $$
BEGIN
  -- Log banking data access for audit purposes
  INSERT INTO public.banking_activity_log (
    user_id, 
    operation, 
    ip_address, 
    status,
    created_at
  ) VALUES (
    auth.uid(),
    'direct_db_' || operation_type,
    inet_client_addr(),
    'success',
    now()
  );
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the operation if logging fails, but log the error
  RAISE WARNING 'Failed to log banking access: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;