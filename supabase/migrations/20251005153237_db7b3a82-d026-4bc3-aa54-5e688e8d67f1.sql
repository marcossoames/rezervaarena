-- Fix booking security functions to use has_role_v2 instead of has_role

-- Drop and recreate enhanced_booking_security function with correct role check
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
      
      IF NOT (has_role_v2(auth.uid(), 'admin'::app_role) OR 
              EXISTS (SELECT 1 FROM facilities WHERE id = NEW.facility_id AND owner_id = auth.uid())) THEN
        RAISE EXCEPTION 'Only admins or facility owners can modify booking details';
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop and recreate validate_financial_operation_security function with correct role check
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