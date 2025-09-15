-- Fix critical security issues - corrected version

-- 1. Drop existing policies and recreate with proper security
DROP POLICY IF EXISTS "Users can view and update their own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles with full access" ON public.profiles; 
DROP POLICY IF EXISTS "Authenticated users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated admins can manage all profiles" ON public.profiles;

-- Create secure policies for profiles table
CREATE POLICY "Secure user profile access" 
ON public.profiles 
FOR ALL 
USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)))
WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)));

-- 2. Fix bank_details policies
DROP POLICY IF EXISTS "Authenticated users can manage their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can only access their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can create their own bank details only" ON public.bank_details;
DROP POLICY IF EXISTS "Users can update their own bank details only" ON public.bank_details;
DROP POLICY IF EXISTS "Users can delete their own bank details only" ON public.bank_details;
DROP POLICY IF EXISTS "Admins can manage all bank details" ON public.bank_details;

-- Secure bank details policies
CREATE POLICY "Secure bank details access" 
ON public.bank_details 
FOR ALL 
USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)))
WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)));

-- 3. Enhanced security function for banking
CREATE OR REPLACE FUNCTION public.enhanced_banking_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Rate limiting for banking operations (5 attempts per 15 minutes)
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait 15 minutes.';
  END IF;
  
  -- Enhanced IBAN validation
  IF TG_TABLE_NAME = 'bank_details' AND NEW.iban IS NOT NULL THEN
    NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
    IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
      RAISE EXCEPTION 'Invalid Romanian IBAN format';
    END IF;
    
    -- Log banking access
    PERFORM log_banking_data_access(TG_OP);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply to bank_details
DROP TRIGGER IF EXISTS enhanced_banking_security_trigger ON public.bank_details;
CREATE TRIGGER enhanced_banking_security_trigger
  BEFORE INSERT OR UPDATE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION enhanced_banking_security();

-- 4. Session validation for sensitive operations
CREATE OR REPLACE FUNCTION public.validate_session_age()
RETURNS TRIGGER AS $$
DECLARE
  jwt_claims JSONB;
  issued_at TIMESTAMP;
  session_age_seconds INTEGER;
BEGIN
  -- Only for sensitive tables
  IF TG_TABLE_NAME IN ('bank_details', 'platform_payments') THEN
    -- Get JWT claims
    jwt_claims := auth.jwt();
    
    IF jwt_claims IS NOT NULL AND jwt_claims ? 'iat' THEN
      -- Convert Unix timestamp to PostgreSQL timestamp
      issued_at := to_timestamp((jwt_claims->>'iat')::bigint);
      session_age_seconds := EXTRACT(EPOCH FROM (now() - issued_at))::INTEGER;
      
      -- Require fresh session (30 minutes) for financial operations
      IF session_age_seconds > 1800 THEN
        RAISE EXCEPTION 'Session too old for financial operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply session validation
DROP TRIGGER IF EXISTS session_validation_trigger ON public.bank_details;
CREATE TRIGGER session_validation_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION validate_session_age();

DROP TRIGGER IF EXISTS session_validation_trigger ON public.platform_payments;
CREATE TRIGGER session_validation_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION validate_session_age();

-- 5. Enhanced audit logging
CREATE OR REPLACE FUNCTION public.comprehensive_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Enhanced audit for admin actions on all sensitive tables
  IF has_role('admin'::user_role) THEN
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
      END,
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'operation', TG_OP,
        'timestamp', now(),
        'ip_address', inet_client_addr(),
        'user_agent', current_setting('request.headers', true)::jsonb->>'user-agent'
      )
    );
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply comprehensive audit to sensitive tables
DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.profiles;
CREATE TRIGGER comprehensive_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION comprehensive_audit_log();

DROP TRIGGER IF EXISTS comprehensive_audit_trigger ON public.bank_details;
CREATE TRIGGER comprehensive_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION comprehensive_audit_log();