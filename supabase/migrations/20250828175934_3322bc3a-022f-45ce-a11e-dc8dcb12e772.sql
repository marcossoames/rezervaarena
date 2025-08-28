-- Fix critical security vulnerabilities

-- 1. Fix SECURITY DEFINER functions to use fixed search_path
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_facility_owner_id(_facility_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT owner_id 
  FROM facilities 
  WHERE id = _facility_id 
    AND is_active = true
    AND auth.uid() IS NOT NULL;
$function$;

-- 2. Remove insecure user_type_comment based authorization and replace with proper role checks
-- Update facilities policies to use proper role-based authorization
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;
CREATE POLICY "Authenticated users can create facilities" 
ON public.facilities 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = owner_id 
  AND auth.uid() IS NOT NULL
  AND (
    has_role('client'::user_role) OR 
    has_role('facility_owner'::user_role) OR 
    has_role('admin'::user_role)
  )
);

-- 3. Fix facility_services policy naming and permissions
DROP POLICY IF EXISTS "Authenticated users can view facility services" ON public.facility_services;
CREATE POLICY "All users can view facility services for active facilities" 
ON public.facility_services 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.id = facility_services.facility_id 
    AND f.is_active = true
  )
);

-- 4. Strengthen profiles policies to prevent unauthorized role changes
DROP POLICY IF EXISTS "Users can update their own profile with role restrictions" ON public.profiles;
CREATE POLICY "Users can update their own profile with role restrictions" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND role = (
    SELECT p.role 
    FROM profiles p 
    WHERE p.user_id = auth.uid() 
    LIMIT 1
  )
  -- Only admins can change roles through secure functions
);

-- 5. Remove potentially dangerous legacy functions that bypass proper authorization
DROP FUNCTION IF EXISTS public.register_facility_with_profile(uuid, text, text, text, text, text, facility_type, text, text, numeric, integer, text[]);

-- 6. Ensure all admin functions properly validate admin role
CREATE OR REPLACE FUNCTION public.promote_user_to_admin_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  target_email text;
BEGIN
  -- Only allow admins to promote users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Prevent self-promotion for audit trail
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot promote yourself';
  END IF;
  
  -- Get target user email
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  
  IF target_email IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Update user role
  UPDATE public.profiles 
  SET role = 'admin'::user_role 
  WHERE user_id = _user_id;
  
  -- Log the action
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'promote_to_admin',
    _user_id,
    target_email,
    jsonb_build_object('timestamp', now())
  );
  
  RETURN FOUND;
END;
$function$;

-- 7. Secure booking validation to prevent price manipulation
CREATE OR REPLACE FUNCTION public.validate_booking_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  facility_record RECORD;
  calculated_duration INTERVAL;
  calculated_hours NUMERIC;
  calculated_total NUMERIC;
BEGIN
  -- Get facility details for validation
  SELECT f.price_per_hour, f.operating_hours_start, f.operating_hours_end, f.is_active
  INTO facility_record
  FROM public.facilities f
  WHERE f.id = NEW.facility_id;
  
  -- Ensure facility exists and is active
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility not found or inactive';
  END IF;
  
  IF NOT facility_record.is_active THEN
    RAISE EXCEPTION 'Cannot book inactive facility';
  END IF;
  
  -- Validate booking is not in the past
  IF NEW.booking_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Cannot book dates in the past';
  END IF;
  
  -- Validate time range
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Validate operating hours (if set)
  IF facility_record.operating_hours_start IS NOT NULL AND facility_record.operating_hours_end IS NOT NULL THEN
    IF NEW.start_time < facility_record.operating_hours_start OR NEW.end_time > facility_record.operating_hours_end THEN
      RAISE EXCEPTION 'Booking time is outside facility operating hours';
    END IF;
  END IF;
  
  -- Calculate duration and total price SERVER-SIDE (ignore client values to prevent manipulation)
  calculated_duration := NEW.end_time - NEW.start_time;
  calculated_hours := EXTRACT(EPOCH FROM calculated_duration) / 3600.0;
  calculated_total := calculated_hours * facility_record.price_per_hour;
  
  -- Override client-provided values with server-calculated ones
  NEW.total_price := calculated_total;
  NEW.total_amount := calculated_total;
  
  -- Set platform fee calculations based on payment method
  IF NEW.payment_method = 'cash' THEN
    NEW.platform_fee_amount := calculated_total * 0.10;
    NEW.facility_owner_amount := calculated_total;
  ELSE
    NEW.platform_fee_amount := calculated_total * 0.10;
    NEW.facility_owner_amount := calculated_total * 0.90;
  END IF;
  
  RETURN NEW;
END;
$function$;