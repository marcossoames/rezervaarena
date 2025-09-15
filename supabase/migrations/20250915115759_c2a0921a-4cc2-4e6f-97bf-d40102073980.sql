-- Fix critical security issues identified in security review

-- 1. Strengthen profiles table RLS to prevent personal info exposure
DROP POLICY IF EXISTS "Authenticated users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated admins can manage all profiles" ON public.profiles;

-- Create more restrictive policies for profiles table
CREATE POLICY "Users can view and update their own profile only" 
ON public.profiles 
FOR ALL 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles with full access" 
ON public.profiles 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- 2. Strengthen bank_details RLS to prevent unauthorized access
DROP POLICY IF EXISTS "Authenticated users can manage their own bank details" ON public.bank_details;

-- Create more restrictive bank details policies
CREATE POLICY "Users can only access their own bank details" 
ON public.bank_details 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can create their own bank details only" 
ON public.bank_details 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can update their own bank details only" 
ON public.bank_details 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank details only" 
ON public.bank_details 
FOR DELETE 
USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Admins can manage all bank details" 
ON public.bank_details 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- 3. Add additional security triggers for sensitive operations
CREATE OR REPLACE FUNCTION public.enhanced_banking_security_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Rate limiting check for banking operations
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait before trying again.';
  END IF;
  
  -- Enhanced validation for financial operations
  IF TG_TABLE_NAME = 'bank_details' THEN
    -- Additional IBAN validation
    IF NEW.iban IS NOT NULL THEN
      NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
      IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
        RAISE EXCEPTION 'Invalid Romanian IBAN format: %', NEW.iban;
      END IF;
    END IF;
    
    -- Log access for audit
    PERFORM log_banking_data_access(TG_OP);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply enhanced security trigger to bank_details
DROP TRIGGER IF EXISTS enhanced_banking_security_trigger ON public.bank_details;
CREATE TRIGGER enhanced_banking_security_trigger
  BEFORE INSERT OR UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION enhanced_banking_security_check();

-- 4. Add session validation for sensitive operations
CREATE OR REPLACE FUNCTION public.validate_sensitive_session()
RETURNS TRIGGER AS $$
DECLARE
  session_age INTEGER;
BEGIN
  -- Only apply to financial tables
  IF TG_TABLE_NAME IN ('bank_details', 'platform_payments', 'bookings') THEN
    -- Check if session is too old for sensitive operations (30 minutes)
    session_age := EXTRACT(EPOCH FROM (now() - auth.jwt()::jsonb ->> 'iat')::timestamp);
    IF session_age > 1800 THEN
      RAISE EXCEPTION 'Session expired for sensitive operations. Please re-authenticate.';
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply session validation to sensitive tables
DROP TRIGGER IF EXISTS sensitive_session_check ON public.bank_details;
CREATE TRIGGER sensitive_session_check
  BEFORE INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION validate_sensitive_session();

DROP TRIGGER IF EXISTS sensitive_session_check ON public.platform_payments;
CREATE TRIGGER sensitive_session_check
  BEFORE INSERT OR UPDATE OR DELETE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION validate_sensitive_session();

-- 5. Enhanced audit logging for all admin actions
CREATE OR REPLACE FUNCTION public.enhanced_admin_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Log all admin actions on sensitive tables
  IF has_role('admin'::user_role) AND TG_TABLE_NAME IN ('profiles', 'bank_details', 'facilities', 'bookings') THEN
    INSERT INTO public.admin_audit_logs (
      admin_user_id,
      action,
      target_user_id,
      metadata
    ) VALUES (
      auth.uid(),
      TG_OP || '_' || TG_TABLE_NAME,
      CASE 
        WHEN TG_TABLE_NAME = 'profiles' THEN COALESCE(NEW.user_id, OLD.user_id)
        WHEN TG_TABLE_NAME = 'bank_details' THEN COALESCE(NEW.user_id, OLD.user_id)
        WHEN TG_TABLE_NAME = 'facilities' THEN COALESCE(NEW.owner_id, OLD.owner_id)
        WHEN TG_TABLE_NAME = 'bookings' THEN COALESCE(NEW.client_id, OLD.client_id)
        ELSE NULL
      END,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', now(),
        'ip_address', inet_client_addr()
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply enhanced audit to all sensitive tables
DROP TRIGGER IF EXISTS enhanced_admin_audit_trigger ON public.profiles;
CREATE TRIGGER enhanced_admin_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION enhanced_admin_audit();

DROP TRIGGER IF EXISTS enhanced_admin_audit_trigger ON public.bank_details;
CREATE TRIGGER enhanced_admin_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION enhanced_admin_audit();

DROP TRIGGER IF EXISTS enhanced_admin_audit_trigger ON public.facilities;
CREATE TRIGGER enhanced_admin_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION enhanced_admin_audit();

DROP TRIGGER IF EXISTS enhanced_admin_audit_trigger ON public.bookings;
CREATE TRIGGER enhanced_admin_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION enhanced_admin_audit();