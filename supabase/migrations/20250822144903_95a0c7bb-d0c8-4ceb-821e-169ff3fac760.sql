-- Fix critical security vulnerabilities

-- 1. Fix profiles table RLS policies to prevent data theft
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create more secure profile viewing policies
CREATE POLICY "Users can only view their own profile data" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 2. Fix admin audit logs access - only admins should access
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;

CREATE POLICY "Only admins can view audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 3. Improve bookings policies to be more restrictive
DROP POLICY IF EXISTS "Clients can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Facility owners can view bookings for their facilities" ON public.bookings;

-- More secure booking viewing policies
CREATE POLICY "Clients can only view their own bookings" 
ON public.bookings 
FOR SELECT 
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ) OR
  EXISTS (
    SELECT 1 FROM public.facilities f
    INNER JOIN public.profiles p ON f.owner_id = p.user_id
    WHERE f.id = facility_id AND p.user_id = auth.uid() AND p.role = 'facility_owner'
  )
);

-- 4. Improve facilities policies
DROP POLICY IF EXISTS "Authenticated users can view active facilities" ON public.facilities;

CREATE POLICY "Public can view active verified facilities" 
ON public.facilities 
FOR SELECT 
USING (
  status = 'active' AND is_verified = true
);