-- ============================================================================
-- PHASE 2: UPDATE ALL RLS POLICIES TO USE has_role_v2
-- ============================================================================

-- Drop and recreate all policies that use has_role to use has_role_v2 instead

-- 1. Update articles policies
DROP POLICY IF EXISTS "Only authenticated admins can manage articles" ON public.articles;
CREATE POLICY "Only authenticated admins can manage articles"
ON public.articles
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role_v2(auth.uid(), 'admin'::app_role));

-- 2. Update admin_audit_logs policies
DROP POLICY IF EXISTS "Only authenticated admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Only authenticated admins can view audit logs"
ON public.admin_audit_logs
FOR SELECT
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 3. Update bank_details policies
DROP POLICY IF EXISTS "Secure bank details access" ON public.bank_details;
CREATE POLICY "Secure bank details access"
ON public.bank_details
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role_v2(auth.uid(), 'admin'::app_role));

-- 4. Update bank_details_audit_logs policies
DROP POLICY IF EXISTS "Only authenticated admins can view bank audit logs" ON public.bank_details_audit_logs;
CREATE POLICY "Only authenticated admins can view bank audit logs"
ON public.bank_details_audit_logs
FOR SELECT
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 5. Update banking_activity_log policies
DROP POLICY IF EXISTS "Only admins can view banking activity logs" ON public.banking_activity_log;
CREATE POLICY "Only admins can view banking activity logs"
ON public.banking_activity_log
FOR SELECT
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 6. Update blocked_dates policies
DROP POLICY IF EXISTS "Authenticated admins can manage all blocked dates" ON public.blocked_dates;
CREATE POLICY "Authenticated admins can manage all blocked dates"
ON public.blocked_dates
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 7. Update bookings policies
DROP POLICY IF EXISTS "Authenticated admins can manage all bookings" ON public.bookings;
CREATE POLICY "Authenticated admins can manage all bookings"
ON public.bookings
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated clients can view their own bookings" ON public.bookings;
CREATE POLICY "Authenticated clients can view their own bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  client_id = auth.uid() 
  OR has_role_v2(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid()
  )
);

-- 8. Update facilities policies
DROP POLICY IF EXISTS "Authenticated admins can manage all facilities" ON public.facilities;
CREATE POLICY "Authenticated admins can manage all facilities"
ON public.facilities
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 9. Update facility_images policies
DROP POLICY IF EXISTS "Authenticated admins can manage all facility images" ON public.facility_images;
CREATE POLICY "Authenticated admins can manage all facility images"
ON public.facility_images
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 10. Update facility_services policies
DROP POLICY IF EXISTS "Authenticated admins can manage all facility services" ON public.facility_services;
CREATE POLICY "Authenticated admins can manage all facility services"
ON public.facility_services
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 11. Update pending_cancellation_emails policies
DROP POLICY IF EXISTS "Only admins can access pending cancellation emails" ON public.pending_cancellation_emails;
CREATE POLICY "Only admins can access pending cancellation emails"
ON public.pending_cancellation_emails
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role_v2(auth.uid(), 'admin'::app_role));

-- 12. Update platform_payments policies
DROP POLICY IF EXISTS "Authenticated admins can manage all platform payments" ON public.platform_payments;
CREATE POLICY "Authenticated admins can manage all platform payments"
ON public.platform_payments
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 13. Update profiles policies
DROP POLICY IF EXISTS "Secure user profile access" ON public.profiles;
CREATE POLICY "Secure user profile access"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id OR has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role_v2(auth.uid(), 'admin'::app_role));

-- 14. Update rate_limit_log policies
DROP POLICY IF EXISTS "Only admins can view rate limit logs" ON public.rate_limit_log;
CREATE POLICY "Only admins can view rate limit logs"
ON public.rate_limit_log
FOR SELECT
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 15. Update recurring_blocked_dates policies
DROP POLICY IF EXISTS "Authenticated admins can manage all recurring blocked dates" ON public.recurring_blocked_dates;
CREATE POLICY "Authenticated admins can manage all recurring blocked dates"
ON public.recurring_blocked_dates
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role));

-- 16. Update sports_complexes policies
DROP POLICY IF EXISTS "Authenticated admins can manage all sports complexes" ON public.sports_complexes;
CREATE POLICY "Authenticated admins can manage all sports complexes"
ON public.sports_complexes
FOR ALL
TO authenticated
USING (has_role_v2(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role_v2(auth.uid(), 'admin'::app_role));

-- 17. Update all database functions that check roles
-- Update get_public_facilities
CREATE OR REPLACE FUNCTION public.get_public_facilities()
RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, address text, description text, price_per_hour numeric, capacity integer, capacity_max integer, images text[], amenities text[], created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id, f.name, f.facility_type, f.city, f.address, f.description,
    f.price_per_hour, f.capacity, f.capacity_max, f.images, f.amenities, f.created_at
  FROM facilities f
  WHERE f.is_active = true 
    AND auth.uid() IS NOT NULL
    AND has_role_v2(auth.uid(), 'admin'::app_role)
  ORDER BY f.created_at DESC;
END;
$$;

-- Update get_sports_complex_with_facilities
CREATE OR REPLACE FUNCTION public.get_sports_complex_with_facilities(owner_id_param uuid)
RETURNS TABLE(complex_id uuid, complex_name text, complex_description text, complex_address text, complex_city text, general_services text[], facility_id uuid, facility_name text, facility_description text, facility_type facility_type, facility_amenities text[], price_per_hour numeric, capacity integer, capacity_max integer, operating_hours_start time without time zone, operating_hours_end time without time zone, images text[], main_image_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != owner_id_param AND NOT has_role_v2(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: can only view your own sports complex';
  END IF;

  RETURN QUERY
  SELECT 
    sc.id AS complex_id, sc.name AS complex_name, sc.description AS complex_description,
    sc.address AS complex_address, sc.city AS complex_city, sc.general_services,
    f.id AS facility_id, f.name AS facility_name, f.description AS facility_description,
    f.facility_type, f.amenities AS facility_amenities, f.price_per_hour,
    f.capacity, f.capacity_max, f.operating_hours_start, f.operating_hours_end,
    f.images, f.main_image_url
  FROM public.sports_complexes sc
  LEFT JOIN public.facilities f ON f.owner_id = sc.owner_id AND f.is_active = true
  WHERE sc.owner_id = owner_id_param
  ORDER BY f.created_at;
END;
$$;

-- Update get_masked_bank_details_for_user
CREATE OR REPLACE FUNCTION public.get_masked_bank_details_for_user(user_id_param uuid)
RETURNS TABLE(id uuid, account_holder_name text, bank_name text, iban_masked text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  IF auth.uid() != user_id_param AND NOT has_role_v2(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: can only view your own bank details';
  END IF;
  
  RETURN QUERY
  SELECT 
    bd.id, bd.account_holder_name, bd.bank_name,
    mask_iban(bd.iban) as iban_masked, bd.created_at, bd.updated_at
  FROM public.bank_details bd
  WHERE bd.user_id = user_id_param;
END;
$$;

-- Update audit triggers to use has_role_v2
CREATE OR REPLACE FUNCTION public.comprehensive_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF has_role_v2(auth.uid(), 'admin'::app_role) THEN
    IF TG_TABLE_NAME IN ('profiles', 'bank_details', 'facilities', 'bookings') THEN
      INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, metadata)
      VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        CASE TG_TABLE_NAME
          WHEN 'profiles' THEN COALESCE(NEW.user_id, OLD.user_id)
          WHEN 'bank_details' THEN COALESCE(NEW.user_id, OLD.user_id)
          WHEN 'facilities' THEN COALESCE(NEW.owner_id, OLD.owner_id)
          WHEN 'bookings' THEN COALESCE(NEW.client_id, OLD.client_id)
        END,
        jsonb_build_object(
          'table', TG_TABLE_NAME,
          'operation', TG_OP,
          'timestamp', now(),
          'ip_address', inet_client_addr()
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Update update_booking_status_owner to use has_role_v2
CREATE OR REPLACE FUNCTION public.update_booking_status_owner(p_booking_id uuid, p_new_status booking_status, p_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid;
  facility_owner_id uuid;
  booking_client_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  
  SELECT f.owner_id, b.client_id
  INTO facility_owner_id, booking_client_id
  FROM public.bookings b
  JOIN public.facilities f ON b.facility_id = f.id
  WHERE b.id = p_booking_id;
  
  IF facility_owner_id IS NULL THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  IF NOT (
    current_user_id = facility_owner_id OR 
    has_role_v2(auth.uid(), 'admin'::app_role) OR
    current_user_id = booking_client_id
  ) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;
  
  UPDATE public.bookings 
  SET 
    status = p_new_status,
    notes = COALESCE(p_notes, notes),
    updated_at = now()
  WHERE id = p_booking_id;
  
  RETURN FOUND;
END;
$$;