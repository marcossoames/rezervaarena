-- Relax sensitive session enforcement for bank_details operations
CREATE OR REPLACE FUNCTION public.validate_sensitive_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  jwt_claims JSONB;
  issued_at_unix BIGINT;
  session_age_seconds INTEGER;
BEGIN
  -- Bypass for internal operations
  IF current_setting('app.internal_op', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Do NOT enforce fresh-session on bank_details to allow owners to save IBAN easily
  IF TG_TABLE_NAME = 'bank_details' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Only apply to high-risk financial tables
  IF TG_TABLE_NAME IN ('platform_payments', 'bookings') THEN
    jwt_claims := auth.jwt();

    IF jwt_claims IS NOT NULL AND jwt_claims ? 'iat' THEN
      issued_at_unix := (jwt_claims->>'iat')::BIGINT;
      session_age_seconds := EXTRACT(EPOCH FROM now())::INTEGER - issued_at_unix;

      -- Require fresh session (30 minutes) for high-risk operations
      IF session_age_seconds > 1800 THEN
        RAISE EXCEPTION 'Session expired for sensitive operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;