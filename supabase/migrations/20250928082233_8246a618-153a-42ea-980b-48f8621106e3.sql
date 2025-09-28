-- Add bypass flag support to security functions and update delete function to set it

-- 1) Update validate_session_security to allow internal operations
CREATE OR REPLACE FUNCTION public.validate_session_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass checks for internal operations (set by edge functions)
  IF current_setting('app.internal_op', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Ensure all sensitive operations have proper authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for this operation';
  END IF;
  
  -- Additional validation for financial operations
  IF TG_TABLE_NAME IN ('bookings', 'platform_payments', 'bank_details') THEN
    -- Validate that the session is recent (not older than 30 minutes for financial ops)
    IF auth.jwt() ->> 'exp' IS NOT NULL THEN
      IF (EXTRACT(EPOCH FROM now()) - (auth.jwt() ->> 'iat')::numeric) > 1800 THEN
        RAISE EXCEPTION 'Session too old for financial operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2) Update validate_banking_operation_security to allow internal operations
CREATE OR REPLACE FUNCTION public.validate_banking_operation_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bypass for internal operations
  IF current_setting('app.internal_op', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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
    IF NEW.account_holder_name IS NOT NULL AND NEW.account_holder_name ~ '[<>"'';&\(\)]' THEN
      RAISE EXCEPTION 'Account holder name contains invalid characters';
    END IF;
    
    IF NEW.bank_name IS NOT NULL AND NEW.bank_name ~ '[<>"'';&\(\)]' THEN
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
$$;

-- 3) Update validate_sensitive_session to allow internal operations
CREATE OR REPLACE FUNCTION public.validate_sensitive_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims JSONB;
  issued_at_unix BIGINT;
  session_age_seconds INTEGER;
BEGIN
  -- Bypass for internal operations
  IF current_setting('app.internal_op', true) = 'true' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

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

-- 4) Recreate delete_user_account_admin to set internal bypass flag
CREATE OR REPLACE FUNCTION public.delete_user_account_admin(user_id_param UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_ids_array UUID[];
BEGIN
  -- Mark this transaction as internal so triggers will allow it
  PERFORM set_config('app.internal_op', 'true', true);

  -- Get facility IDs owned by this user
  SELECT ARRAY(SELECT id FROM public.facilities WHERE owner_id = user_id_param) INTO facility_ids_array;
  
  -- Delete all bookings by this user
  DELETE FROM public.bookings WHERE client_id = user_id_param;
  
  -- Delete all bookings for facilities owned by this user
  IF array_length(facility_ids_array, 1) > 0 THEN
    DELETE FROM public.bookings WHERE facility_id = ANY(facility_ids_array);
  END IF;
  
  -- Delete platform payments
  DELETE FROM public.platform_payments WHERE client_id = user_id_param OR facility_owner_id = user_id_param;
  
  -- Delete facility-related data
  IF array_length(facility_ids_array, 1) > 0 THEN
    DELETE FROM public.facility_services WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facility_images WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.recurring_blocked_dates WHERE facility_id = ANY(facility_ids_array);
    DELETE FROM public.facilities WHERE owner_id = user_id_param;
    DELETE FROM public.sports_complexes WHERE owner_id = user_id_param;
  END IF;
  
  -- Delete bank details
  DELETE FROM public.bank_details WHERE user_id = user_id_param;
  
  -- Delete profile
  DELETE FROM public.profiles WHERE user_id = user_id_param;
  
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error during account deletion: %', SQLERRM;
END;
$$;