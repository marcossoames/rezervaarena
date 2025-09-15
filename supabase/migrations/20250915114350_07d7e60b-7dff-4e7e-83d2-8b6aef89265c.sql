-- Critical Security Fixes Migration
-- 1. Fix RLS policies to require authentication instead of allowing anonymous access
-- 2. Add additional security constraints and validations

-- Update all RLS policies to require authentication (no anonymous access)

-- Fix admin_audit_logs policies
DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Only authenticated admins can view audit logs"
ON public.admin_audit_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- Fix articles policies
DROP POLICY IF EXISTS "Admins can manage all articles" ON public.articles;
DROP POLICY IF EXISTS "Authenticated users can view published articles" ON public.articles;

CREATE POLICY "Only authenticated admins can manage articles"
ON public.articles 
FOR ALL 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Only authenticated users can view published articles"
ON public.articles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_published = true);

-- Fix bank_details policies (already have auth checks but strengthen them)
DROP POLICY IF EXISTS "Users can delete their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can update their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can view their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can insert their own bank details" ON public.bank_details;

CREATE POLICY "Authenticated users can manage their own bank details"
ON public.bank_details 
FOR ALL
USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)))
WITH CHECK (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)));

-- Fix bank_details_audit_logs policies
DROP POLICY IF EXISTS "Only admins can view bank details audit logs" ON public.bank_details_audit_logs;
CREATE POLICY "Only authenticated admins can view bank audit logs"
ON public.bank_details_audit_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- Fix blocked_dates policies
DROP POLICY IF EXISTS "Admins can manage all blocked dates" ON public.blocked_dates;
DROP POLICY IF EXISTS "Authenticated users can view blocked dates for booking" ON public.blocked_dates;
DROP POLICY IF EXISTS "Facility owners can manage their blocked dates" ON public.blocked_dates;

CREATE POLICY "Authenticated admins can manage all blocked dates"
ON public.blocked_dates 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can view blocked dates for booking"
ON public.blocked_dates 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = blocked_dates.facility_id AND f.is_active = true
));

CREATE POLICY "Authenticated facility owners can manage their blocked dates"
ON public.blocked_dates 
FOR ALL
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = blocked_dates.facility_id AND f.owner_id = auth.uid()
))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = blocked_dates.facility_id AND f.owner_id = auth.uid()
));

-- Fix bookings policies
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can only view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can update their pending bookings" ON public.bookings;
DROP POLICY IF EXISTS "Facility owners can update bookings for their facilities" ON public.bookings;
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;

CREATE POLICY "Authenticated admins can manage all bookings"
ON public.bookings 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated clients can view their own bookings"
ON public.bookings 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND (
  client_id = auth.uid() OR 
  has_role('admin'::user_role) OR 
  EXISTS (SELECT 1 FROM facilities f WHERE f.id = bookings.facility_id AND f.owner_id = auth.uid())
));

CREATE POLICY "Authenticated clients can create their own bookings"
ON public.bookings 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = client_id);

CREATE POLICY "Authenticated clients can update their pending bookings"
ON public.bookings 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND auth.uid() = client_id AND status = 'pending'::booking_status)
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = client_id);

CREATE POLICY "Authenticated facility owners can update their facility bookings"
ON public.bookings 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities WHERE facilities.id = bookings.facility_id AND facilities.owner_id = auth.uid()
))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities WHERE facilities.id = bookings.facility_id AND facilities.owner_id = auth.uid()
));

-- Fix facilities policies
DROP POLICY IF EXISTS "Admins can manage all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Admins can view all facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners and admins can delete facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners and admins can update facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners and admins can view their facilities" ON public.facilities;
DROP POLICY IF EXISTS "Facility owners can view their own facilities" ON public.facilities;
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;

CREATE POLICY "Authenticated admins can manage all facilities"
ON public.facilities 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can create facilities"
ON public.facilities 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = owner_id);

CREATE POLICY "Authenticated facility owners can manage their own facilities"
ON public.facilities 
FOR ALL
USING (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR has_role('admin'::user_role)))
WITH CHECK (auth.uid() IS NOT NULL AND (owner_id = auth.uid() OR has_role('admin'::user_role)));

-- Fix facility_images policies
DROP POLICY IF EXISTS "Admins can manage all facility images" ON public.facility_images;
DROP POLICY IF EXISTS "Authenticated users can view facility images" ON public.facility_images;
DROP POLICY IF EXISTS "Authenticated users can view facility images for active facilit" ON public.facility_images;
DROP POLICY IF EXISTS "Facility owners can manage their facility images" ON public.facility_images;

CREATE POLICY "Authenticated admins can manage all facility images"
ON public.facility_images 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can view facility images for active facilities"
ON public.facility_images 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_images.facility_id AND f.is_active = true
));

CREATE POLICY "Authenticated facility owners can manage their facility images"
ON public.facility_images 
FOR ALL
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_images.facility_id AND f.owner_id = auth.uid()
))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_images.facility_id AND f.owner_id = auth.uid()
));

-- Fix facility_services policies
DROP POLICY IF EXISTS "Admins can manage all facility services" ON public.facility_services;
DROP POLICY IF EXISTS "Authenticated users can view facility services" ON public.facility_services;
DROP POLICY IF EXISTS "Authenticated users can view facility services for active facil" ON public.facility_services;
DROP POLICY IF EXISTS "Facility owners can manage their facility services" ON public.facility_services;

CREATE POLICY "Authenticated admins can manage all facility services"
ON public.facility_services 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can view facility services for active facilities"
ON public.facility_services 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_services.facility_id AND f.is_active = true
));

CREATE POLICY "Authenticated facility owners can manage their facility services"
ON public.facility_services 
FOR ALL
USING (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_services.facility_id AND f.owner_id = auth.uid()
))
WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (
  SELECT 1 FROM facilities f 
  WHERE f.id = facility_services.facility_id AND f.owner_id = auth.uid()
));

-- Fix platform_payments policies
DROP POLICY IF EXISTS "Admins can manage all platform payments" ON public.platform_payments;
DROP POLICY IF EXISTS "Clients can view their payments" ON public.platform_payments;
DROP POLICY IF EXISTS "Facility owners can view their payments" ON public.platform_payments;

CREATE POLICY "Authenticated admins can manage all platform payments"
ON public.platform_payments 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated clients can view their own payments"
ON public.platform_payments 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND client_id = auth.uid());

CREATE POLICY "Authenticated facility owners can view their payments"
ON public.platform_payments 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND facility_owner_id = auth.uid());

-- Fix profiles policies
DROP POLICY IF EXISTS "Admins can update any profile including roles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view their own profile data" ON public.profiles;
DROP POLICY IF EXISTS "Explicit authenticated access only for profiles" ON public.profiles;

CREATE POLICY "Authenticated admins can manage all profiles"
ON public.profiles 
FOR ALL
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role))
WITH CHECK (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

CREATE POLICY "Authenticated users can manage their own profile"
ON public.profiles 
FOR ALL
USING (auth.uid() IS NOT NULL AND (auth.uid() = user_id OR has_role('admin'::user_role)))
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id AND role = get_current_user_role());

-- Add security validation for sensitive operations
CREATE OR REPLACE FUNCTION public.validate_session_security()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure all sensitive operations have proper authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required for this operation';
  END IF;
  
  -- Additional validation for financial operations
  IF TG_TABLE_NAME IN ('bookings', 'platform_payments', 'bank_details') THEN
    -- Validate that the session is recent (not older than 30 minutes for financial ops)
    IF auth.jwt() ->> 'exp' IS NOT NULL THEN
      IF (EXTRACT(EPOCH FROM now()) - (auth.jwt() ->> 'iat')::numeric) > 1800 THEN
        RAISE EXCEPTION 'Session too old for financial operations. Please re-authenticate.';
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply security validation triggers to sensitive tables
CREATE TRIGGER validate_bookings_security
  BEFORE INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_security();

CREATE TRIGGER validate_platform_payments_security
  BEFORE INSERT OR UPDATE OR DELETE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_session_security();

-- Add rate limiting for sensitive operations
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation TEXT NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on rate limit log
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view rate limit logs"
ON public.rate_limit_log 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND has_role('admin'::user_role));

-- Create rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(operation_name TEXT, max_attempts INTEGER DEFAULT 10, window_minutes INTEGER DEFAULT 60)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Count recent attempts
  SELECT COUNT(*) INTO attempt_count
  FROM public.rate_limit_log
  WHERE user_id = current_user_id
    AND operation = operation_name
    AND created_at > now() - (window_minutes || ' minutes')::INTERVAL;
  
  -- Log this attempt
  INSERT INTO public.rate_limit_log (user_id, operation, ip_address)
  VALUES (current_user_id, operation_name, inet_client_addr());
  
  -- Return true if within limits
  RETURN attempt_count < max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;