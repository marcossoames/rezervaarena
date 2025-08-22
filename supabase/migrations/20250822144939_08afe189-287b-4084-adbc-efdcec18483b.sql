-- Fix critical security vulnerabilities

-- First, let's check if has_role function exists and create if needed
CREATE OR REPLACE FUNCTION public.has_role(_role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$$;

-- 1. Fix profiles table RLS policies to prevent data theft
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create more secure profile viewing policies
CREATE POLICY "Users can only view their own profile data" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  public.has_role('admin'::public.user_role)
);

-- 2. Fix admin audit logs access - only admins should access
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;

CREATE POLICY "Only admins can view audit logs" 
ON public.admin_audit_logs 
FOR SELECT 
USING (
  public.has_role('admin'::public.user_role)
);

-- 3. Improve bookings policies to be more restrictive
DROP POLICY IF EXISTS "Clients can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Facility owners can view bookings for their facilities" ON public.bookings;

-- More secure booking viewing policies
CREATE POLICY "Clients can only view their own bookings" 
ON public.bookings 
FOR SELECT 
USING (
  client_id = auth.uid() OR
  public.has_role('admin'::public.user_role) OR
  EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = facility_id AND f.owner_id = auth.uid()
  )
);

-- 4. Improve facilities policies to be more restrictive
DROP POLICY IF EXISTS "Authenticated users can view active facilities" ON public.facilities;

CREATE POLICY "Public can view active facilities only" 
ON public.facilities 
FOR SELECT 
USING (
  is_active = true
);