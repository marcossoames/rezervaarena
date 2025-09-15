-- Fix validate_sensitive_session to avoid 'timestamp with time zone - jsonb' error
CREATE OR REPLACE FUNCTION public.validate_sensitive_session()
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
  -- Only apply to financial tables
  IF TG_TABLE_NAME IN ('bank_details', 'platform_payments', 'bookings') THEN
    -- Get JWT claims
    jwt_claims := auth.jwt();

    IF jwt_claims IS NOT NULL AND jwt_claims ? 'iat' THEN
      -- Safely compute session age from unix seconds
      issued_at_unix := (jwt_claims->>'iat')::BIGINT;
      session_age_seconds := EXTRACT(EPOCH FROM now())::INTEGER - issued_at_unix;

      IF session_age_seconds > 1800 THEN
        RAISE EXCEPTION 'Session expired for sensitive operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;