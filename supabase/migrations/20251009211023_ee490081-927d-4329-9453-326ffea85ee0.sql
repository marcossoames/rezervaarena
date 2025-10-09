-- Fix overlapping uniqueness to ignore cancelled bookings
-- 1) Drop existing unique index if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'no_overlapping_bookings'
  ) THEN
    EXECUTE 'DROP INDEX public.no_overlapping_bookings';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not drop index no_overlapping_bookings: %', SQLERRM;
END $$;

-- 2) Recreate partial unique index that applies only to active bookings (pending/confirmed)
CREATE UNIQUE INDEX IF NOT EXISTS no_overlapping_bookings
ON public.bookings (facility_id, booking_date, start_time, end_time)
WHERE status IN ('pending'::booking_status, 'confirmed'::booking_status);

-- 3) Optional safety: ensure cancelled bookings no longer block by aligning triggers
--    The existing prevent_booking_overlap/check_booking_overlap functions already check status IN ('confirmed','pending').
--    No change needed there.

-- 4) Cleanup any historical duplicates among cancelled bookings that violate the old unique index logic is not needed
--    after switching to partial index.
