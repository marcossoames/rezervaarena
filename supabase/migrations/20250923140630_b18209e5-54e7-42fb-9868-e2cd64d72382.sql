-- Ensure unique index for full-day blocks to support ON CONFLICT in generate_blocked_dates_from_recurring
CREATE UNIQUE INDEX IF NOT EXISTS blocked_dates_full_day_unique_idx
ON public.blocked_dates (facility_id, blocked_date)
WHERE start_time IS NULL AND end_time IS NULL;

-- Ensure trigger exists to generate blocked dates after inserting recurring rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_generate_blocked_dates_from_recurring'
  ) THEN
    CREATE TRIGGER trg_generate_blocked_dates_from_recurring
    AFTER INSERT ON public.recurring_blocked_dates
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_blocked_dates_from_recurring();
  END IF;
END $$;
