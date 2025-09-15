-- Phase 1: Critical RLS Policy Fixes

-- Fix facilities table RLS policy to prevent exposure of sensitive data
DROP POLICY IF EXISTS "Authenticated admins can manage all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated facility owners can manage their own facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;

-- Create more secure facilities policies
CREATE POLICY "Authenticated admins can manage all facilities" 
ON public.facilities 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND has_role('admin'::user_role)
);

CREATE POLICY "Authenticated facility owners can manage their own facilities" 
ON public.facilities 
FOR ALL 
USING (
  auth.uid() IS NOT NULL 
  AND owner_id = auth.uid()
) 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND owner_id = auth.uid()
);

CREATE POLICY "Authenticated users can view active facilities only" 
ON public.facilities 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_active = true
);

CREATE POLICY "Authenticated users can create facilities for themselves" 
ON public.facilities 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND auth.uid() = owner_id
  AND is_active = true
);

-- Fix articles table to ensure only authenticated users can view published articles
DROP POLICY IF EXISTS "Only authenticated users can view published articles" ON public.articles;

CREATE POLICY "Only authenticated users can view published articles" 
ON public.articles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND is_published = true
);

-- Enhance banking security with additional session validation
CREATE OR REPLACE FUNCTION public.validate_financial_operation_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  session_age INTEGER;
  jwt_claims JSONB;
BEGIN
  -- Ensure authentication for all financial operations
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for financial operations';
  END IF;
  
  -- Additional session age validation for high-risk operations
  IF TG_TABLE_NAME IN ('bank_details', 'platform_payments') THEN
    jwt_claims := auth.jwt();
    
    IF jwt_claims IS NOT NULL AND jwt_claims ? 'iat' THEN
      session_age := EXTRACT(EPOCH FROM (now() - to_timestamp((jwt_claims->>'iat')::bigint)))::INTEGER;
      
      -- Require fresh session (15 minutes) for banking operations
      IF session_age > 900 THEN
        RAISE EXCEPTION 'Session too old for banking operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;
  
  -- Enhanced rate limiting for financial operations
  IF NOT check_rate_limit('financial_operation', 3, 10) THEN
    RAISE EXCEPTION 'Rate limit exceeded for financial operations. Please wait.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Apply enhanced financial security trigger
DROP TRIGGER IF EXISTS validate_financial_operation_security_trigger ON public.bank_details;
CREATE TRIGGER validate_financial_operation_security_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.bank_details
  FOR EACH ROW EXECUTE FUNCTION validate_financial_operation_security();

DROP TRIGGER IF EXISTS validate_financial_operation_security_trigger ON public.platform_payments;
CREATE TRIGGER validate_financial_operation_security_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION validate_financial_operation_security();

-- Enhanced booking security validation
CREATE OR REPLACE FUNCTION public.enhanced_booking_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Ensure authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for booking operations';
  END IF;
  
  -- Prevent booking manipulation
  IF TG_OP = 'UPDATE' THEN
    -- Only allow status updates by facility owners or admins
    IF OLD.client_id != NEW.client_id OR 
       OLD.facility_id != NEW.facility_id OR
       OLD.booking_date != NEW.booking_date OR
       OLD.start_time != NEW.start_time OR
       OLD.end_time != NEW.end_time THEN
      
      IF NOT (has_role('admin'::user_role) OR 
              EXISTS (SELECT 1 FROM facilities WHERE id = NEW.facility_id AND owner_id = auth.uid())) THEN
        RAISE EXCEPTION 'Only admins or facility owners can modify booking details';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply enhanced booking security
DROP TRIGGER IF EXISTS enhanced_booking_security_trigger ON public.bookings;
CREATE TRIGGER enhanced_booking_security_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION enhanced_booking_security();