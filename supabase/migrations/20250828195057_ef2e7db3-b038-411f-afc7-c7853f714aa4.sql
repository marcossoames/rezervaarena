-- Database Security Hardening

-- 1. Create partial unique index to prevent exact duplicate bookings
CREATE UNIQUE INDEX IF NOT EXISTS bookings_no_exact_duplicates
ON public.bookings (facility_id, booking_date, start_time, end_time)
WHERE status IN ('confirmed', 'pending');

-- 2. Create triggers for bookings table security
CREATE TRIGGER validate_booking_security_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER prevent_booking_overlap_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_booking_overlap();

CREATE TRIGGER protect_booking_integrity_trigger
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.protect_booking_integrity();

CREATE TRIGGER update_bookings_updated_at_trigger
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_booking_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_client_booking_stats();

-- 3. Create updated_at triggers for other tables
CREATE TRIGGER update_facilities_updated_at_trigger
BEFORE UPDATE ON public.facilities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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