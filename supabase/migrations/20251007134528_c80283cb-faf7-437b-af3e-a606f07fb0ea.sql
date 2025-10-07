-- 1) Create a brand-new, simple table for facility owners' bank details
CREATE TABLE IF NOT EXISTS public.facility_owner_bank_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  account_holder_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  iban TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.facility_owner_bank_details ENABLE ROW LEVEL SECURITY;

-- 2) Helper functions: sanitize + IBAN validation + updated_at trigger
CREATE OR REPLACE FUNCTION public.sanitize_text(_input text)
RETURNS text AS $$
  SELECT trim(regexp_replace(coalesce(_input,''), '[<>"'';&()]', '', 'g'));
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.validate_romanian_iban(_iban text)
RETURNS boolean AS $$
DECLARE
  clean text;
BEGIN
  clean := upper(replace(coalesce(_iban,''), ' ', ''));
  RETURN clean ~ '^RO\d{2}[A-Z]{4}[A-Z0-9]{16}$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fobd_validate_before_write()
RETURNS trigger AS $$
BEGIN
  NEW.account_holder_name := public.sanitize_text(NEW.account_holder_name);
  NEW.bank_name := public.sanitize_text(NEW.bank_name);
  NEW.iban := upper(replace(NEW.iban, ' ', ''));

  IF length(NEW.account_holder_name) < 2 THEN
    RAISE EXCEPTION 'Account holder name too short';
  END IF;
  IF length(NEW.bank_name) < 2 THEN
    RAISE EXCEPTION 'Bank name too short';
  END IF;
  IF NOT public.validate_romanian_iban(NEW.iban) THEN
    RAISE EXCEPTION 'Invalid Romanian IBAN format';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS fobd_set_updated_at ON public.facility_owner_bank_details;
CREATE TRIGGER fobd_set_updated_at
BEFORE UPDATE ON public.facility_owner_bank_details
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS fobd_validate_before_write ON public.facility_owner_bank_details;
CREATE TRIGGER fobd_validate_before_write
BEFORE INSERT OR UPDATE ON public.facility_owner_bank_details
FOR EACH ROW EXECUTE FUNCTION public.fobd_validate_before_write();

-- 3) RLS policies: owner full access, admins can view
DROP POLICY IF EXISTS fobd_owner_manage ON public.facility_owner_bank_details;
CREATE POLICY fobd_owner_manage
ON public.facility_owner_bank_details
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS fobd_admin_view ON public.facility_owner_bank_details;
CREATE POLICY fobd_admin_view
ON public.facility_owner_bank_details
FOR SELECT
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_fobd_user_id ON public.facility_owner_bank_details(user_id);
