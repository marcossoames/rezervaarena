-- Fix the validate_session_age function that's causing the timestamp error
DROP FUNCTION IF EXISTS public.validate_session_age() CASCADE;

-- Create a corrected version that properly handles JWT timestamp conversion
CREATE OR REPLACE FUNCTION public.validate_session_age()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jwt_claims JSONB;
  issued_at_unix BIGINT;
  session_age_seconds INTEGER;
BEGIN
  -- Only for sensitive tables
  IF TG_TABLE_NAME IN ('bank_details', 'platform_payments') THEN
    -- Get JWT claims
    jwt_claims := auth.jwt();
    
    IF jwt_claims IS NOT NULL AND jwt_claims ? 'iat' THEN
      -- Extract Unix timestamp as bigint and calculate age properly
      issued_at_unix := (jwt_claims->>'iat')::BIGINT;
      session_age_seconds := EXTRACT(EPOCH FROM now())::INTEGER - issued_at_unix;
      
      -- Require fresh session (30 minutes) for financial operations
      IF session_age_seconds > 1800 THEN
        RAISE EXCEPTION 'Session too old for financial operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;