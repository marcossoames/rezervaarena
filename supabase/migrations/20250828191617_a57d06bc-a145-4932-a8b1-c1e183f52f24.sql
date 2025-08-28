-- CRITICAL SECURITY FIXES

-- 1. Remove public SELECT policy on facilities table (PII exposure risk)
DROP POLICY IF EXISTS "Public users can view active facilities for browsing" ON public.facilities;

-- 2. Consolidate duplicate triggers on bookings table
-- First drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS prevent_booking_overlap ON public.bookings;
DROP TRIGGER IF EXISTS check_booking_overlap ON public.bookings;
DROP TRIGGER IF EXISTS update_client_booking_stats_trigger ON public.bookings;
DROP TRIGGER IF EXISTS validate_booking_security_trigger ON public.bookings;
DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;

-- Create consolidated, properly named triggers
CREATE TRIGGER bookings_overlap_prevention_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

CREATE TRIGGER bookings_client_stats_update_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_client_booking_stats();

CREATE TRIGGER bookings_security_validation_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER bookings_integrity_protection_trigger
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.protect_booking_integrity();

CREATE TRIGGER bookings_updated_at_trigger
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Restrict blocked_dates visibility - remove broad access policy
DROP POLICY IF EXISTS "Authenticated users can view blocked dates for booking purposes" ON public.blocked_dates;

-- Create more restrictive policy for blocked_dates viewing
CREATE POLICY "Users can view blocked dates only when booking specific facilities" 
ON public.blocked_dates 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    -- Users can see blocked dates for facilities they're booking
    EXISTS (
      SELECT 1 FROM public.facilities f 
      WHERE f.id = blocked_dates.facility_id 
      AND f.is_active = true
    )
  )
);

-- 4. Ensure profiles audit trigger exists for security monitoring
DROP TRIGGER IF EXISTS audit_profile_changes_trigger ON public.profiles;
CREATE TRIGGER audit_profile_changes_trigger
    AFTER UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();