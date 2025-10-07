-- Remove encryption-related trigger logic and simplify IBAN validation
-- Keep only basic Romanian IBAN format validation

-- 1) Simplify validate_bank_details_security - remove encryption checks
CREATE OR REPLACE FUNCTION public.validate_bank_details_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate IBAN format for Romanian IBANs
  IF NEW.iban IS NOT NULL THEN
    -- Remove spaces and convert to uppercase
    NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
    -- Validate Romanian IBAN format: RO + 2 digits + 4 letters + 16 alphanumeric
    IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
      RAISE EXCEPTION 'IBAN format invalid. Must be Romanian IBAN format: RO + 2 digits + 4 letters + 16 alphanumeric characters';
    END IF;
  END IF;
  
  -- Validate account holder name (no special characters)
  IF NEW.account_holder_name IS NOT NULL THEN
    IF NEW.account_holder_name ~ '[<>"'';&\(\)]' THEN
      RAISE EXCEPTION 'Account holder name contains invalid characters';
    END IF;
    
    IF LENGTH(TRIM(NEW.account_holder_name)) < 2 THEN
      RAISE EXCEPTION 'Account holder name must be at least 2 characters long';
    END IF;
  END IF;
  
  -- Validate bank name
  IF NEW.bank_name IS NOT NULL THEN
    IF NEW.bank_name ~ '[<>"'';&\(\)]' THEN
      RAISE EXCEPTION 'Bank name contains invalid characters';
    END IF;
    
    IF LENGTH(TRIM(NEW.bank_name)) < 2 THEN
      RAISE EXCEPTION 'Bank name must be at least 2 characters long';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2) Simplify enhanced_banking_security_check
CREATE OR REPLACE FUNCTION public.enhanced_banking_security_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Rate limiting check
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait before trying again.';
  END IF;
  
  -- Simple IBAN validation for bank_details table
  IF TG_TABLE_NAME = 'bank_details' AND NEW.iban IS NOT NULL THEN
    NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
    IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
      RAISE EXCEPTION 'Invalid Romanian IBAN format: %', NEW.iban;
    END IF;
    
    -- Log access for audit
    PERFORM log_banking_data_access(TG_OP);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3) Simplify enhanced_banking_security
CREATE OR REPLACE FUNCTION public.enhanced_banking_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Rate limiting
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait 15 minutes.';
  END IF;
  
  -- Simple IBAN validation
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
$function$;