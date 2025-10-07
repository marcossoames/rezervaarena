-- Fix IBAN validation to be compatible with encrypted storage
-- Validate format only when value looks like a plaintext Romanian IBAN (starts with 'RO')

-- 1) validate_bank_details_security
CREATE OR REPLACE FUNCTION public.validate_bank_details_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate IBAN format more strictly only for plaintext IBAN
  IF NEW.iban IS NOT NULL THEN
    -- If it looks like a raw IBAN (starts with RO), validate; otherwise assume encrypted and skip format check
    IF position('RO' in NEW.iban) = 1 THEN
      -- Remove spaces and convert to uppercase for validation
      NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
      -- Validate Romanian IBAN format
      IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
        RAISE EXCEPTION 'IBAN format invalid. Must be Romanian IBAN format: RO + 2 digits + 4 letters + 16 alphanumeric characters';
      END IF;
    END IF;
  END IF;
  
  -- Validate account holder name (no special characters that could indicate injection)
  IF NEW.account_holder_name IS NOT NULL THEN
    IF NEW.account_holder_name ~ '[<>"'';&\(\)]' THEN
      RAISE EXCEPTION 'Account holder name contains invalid characters';
    END IF;
    
    -- Ensure minimum length
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

-- 2) enhanced_banking_security_check
CREATE OR REPLACE FUNCTION public.enhanced_banking_security_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Rate limiting check for banking operations
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait before trying again.';
  END IF;
  
  -- Enhanced validation for financial operations
  IF TG_TABLE_NAME = 'bank_details' THEN
    -- Additional IBAN validation only if the value looks like plaintext
    IF NEW.iban IS NOT NULL THEN
      IF position('RO' in NEW.iban) = 1 THEN
        NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
        IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
          RAISE EXCEPTION 'Invalid Romanian IBAN format: %', NEW.iban;
        END IF;
      END IF;
    END IF;
    
    -- Log access for audit
    PERFORM log_banking_data_access(TG_OP);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 3) enhanced_banking_security
CREATE OR REPLACE FUNCTION public.enhanced_banking_security()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Rate limiting for banking operations (5 attempts per 15 minutes)
  IF NOT check_rate_limit('banking_operation', 5, 15) THEN
    RAISE EXCEPTION 'Rate limit exceeded for banking operations. Please wait 15 minutes.';
  END IF;
  
  -- Enhanced IBAN validation for plaintext values only
  IF TG_TABLE_NAME = 'bank_details' AND NEW.iban IS NOT NULL THEN
    IF position('RO' in NEW.iban) = 1 THEN
      NEW.iban := UPPER(REPLACE(NEW.iban, ' ', ''));
      IF NOT (NEW.iban ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$') THEN
        RAISE EXCEPTION 'Invalid Romanian IBAN format';
      END IF;
    END IF;
    
    -- Log banking access
    PERFORM log_banking_data_access(TG_OP);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;