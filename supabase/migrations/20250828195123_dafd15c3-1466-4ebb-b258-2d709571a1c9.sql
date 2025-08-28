-- Database Security Hardening - Create only missing triggers and index

-- 1. Create partial unique index to prevent exact duplicate bookings
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_exact_duplicates
ON public.bookings (facility_id, booking_date, start_time, end_time)
WHERE status IN ('confirmed', 'pending');

-- 2. Create missing triggers for bookings table security
-- Check and create validate_booking_security_trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_booking_security_trigger') THEN
        CREATE TRIGGER validate_booking_security_trigger
        BEFORE INSERT OR UPDATE ON public.bookings
        FOR EACH ROW
        EXECUTE FUNCTION public.validate_booking_security();
    END IF;
END $$;

-- Check and create protect_booking_integrity_trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_booking_integrity_trigger') THEN
        CREATE TRIGGER protect_booking_integrity_trigger
        BEFORE UPDATE ON public.bookings
        FOR EACH ROW
        EXECUTE FUNCTION public.protect_booking_integrity();
    END IF;
END $$;

-- Check and create update_bookings_updated_at_trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_bookings_updated_at_trigger') THEN
        CREATE TRIGGER update_bookings_updated_at_trigger
        BEFORE UPDATE ON public.bookings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Check and create update_client_booking_stats_trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_client_booking_stats_trigger') THEN
        CREATE TRIGGER update_client_booking_stats_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.bookings
        FOR EACH ROW
        EXECUTE FUNCTION public.update_client_booking_stats();
    END IF;
END $$;

-- 3. Create updated_at triggers for other tables
-- Check and create facilities trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_facilities_updated_at_trigger') THEN
        CREATE TRIGGER update_facilities_updated_at_trigger
        BEFORE UPDATE ON public.facilities
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Check and create profiles trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at_trigger') THEN
        CREATE TRIGGER update_profiles_updated_at_trigger
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- 4. Fix profiles UPDATE policy to avoid recursion risk
DROP POLICY IF EXISTS "Users can update their own profile with role restrictions" ON public.profiles;

CREATE POLICY "Users can update their own profile with role restrictions"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = get_current_user_role()
);