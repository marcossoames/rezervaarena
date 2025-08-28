-- Security fixes implementation

-- 1. Ensure booking validation trigger is active
DROP TRIGGER IF EXISTS booking_validation_trigger ON public.bookings;
CREATE TRIGGER booking_validation_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_security();

-- 2. Ensure booking overlap prevention trigger is active  
DROP TRIGGER IF EXISTS prevent_booking_overlap_trigger ON public.bookings;
CREATE TRIGGER prevent_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();

-- 3. Ensure booking integrity protection trigger is active
DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
CREATE TRIGGER protect_booking_integrity_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_integrity();

-- 4. Ensure client booking stats trigger is active
DROP TRIGGER IF EXISTS update_client_stats_trigger ON public.bookings;
CREATE TRIGGER update_client_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_client_booking_stats();

-- 5. Add unique constraint on profiles.user_id for data integrity
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_unique;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- 6. Tighten anonymous access policies - remove overly permissive policies
DROP POLICY IF EXISTS "Anyone can view blocked dates for booking purposes" ON public.blocked_dates;
CREATE POLICY "Authenticated users can view blocked dates for booking purposes" 
ON public.blocked_dates 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 7. Ensure facility images have proper access control
DROP POLICY IF EXISTS "Authenticated users can view facility images" ON public.facility_images;
CREATE POLICY "Public can view facility images for active facilities" 
ON public.facility_images 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.id = facility_images.facility_id 
    AND f.is_active = true
  )
);

-- 8. Add audit trigger for profile changes (security monitoring)
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
    VALUES (
      auth.uid(),
      'role_change',
      NEW.user_id,
      NEW.email,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_profile_changes_trigger ON public.profiles;
CREATE TRIGGER audit_profile_changes_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();