-- Fix overlapping/duplicate booking errors by removing legacy constraint and aligning overlap checks
-- 1) Drop legacy constraint/index if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'bookings'
      AND constraint_name = 'no_overlapping_bookings'
  ) THEN
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT no_overlapping_bookings';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'no_overlapping_bookings'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP INDEX public.no_overlapping_bookings';
  END IF;
END $$;

-- 2) Align DB overlap logic with UI: consider only confirmed and recent pending (<10 min)
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ten_minutes_ago timestamptz := now() - interval '10 minutes';
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.facility_id = NEW.facility_id
      AND b.booking_date = NEW.booking_date
      AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ((NEW.start_time, NEW.end_time) OVERLAPS (b.start_time, b.end_time))
      AND (
        b.status = 'confirmed'
        OR (b.status = 'pending' AND b.created_at >= ten_minutes_ago)
      )
  ) THEN
    RAISE EXCEPTION 'Booking time overlaps with existing booking';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Ensure trigger exists to call the updated function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_check_booking_overlap'
  ) THEN
    CREATE TRIGGER trg_check_booking_overlap
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.check_booking_overlap();
  END IF;
END $$;