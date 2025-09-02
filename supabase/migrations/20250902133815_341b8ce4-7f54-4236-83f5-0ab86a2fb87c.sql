-- Add security improvements to RLS policies

-- Ensure all write policies have proper WITH CHECK clauses
-- Update profiles policies to be more explicit about authentication

-- Drop and recreate profiles policies for better security
DROP POLICY IF EXISTS "Authenticated users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;

-- Recreate with explicit authentication checks and WITH CHECK clauses
CREATE POLICY "Authenticated users can create their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND (auth.uid() = user_id) 
  AND ((role = 'client'::user_role) OR (role = 'facility_owner'::user_role))
);

CREATE POLICY "Authenticated users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id))
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND (auth.uid() = user_id) 
  AND (role = get_current_user_role())
);

-- Update bookings policies to ensure proper authentication
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can update their pending bookings" ON public.bookings;

CREATE POLICY "Clients can create bookings" 
ON public.bookings 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND (auth.uid() = client_id));

CREATE POLICY "Clients can update their pending bookings" 
ON public.bookings 
FOR UPDATE 
TO authenticated
USING (
  (auth.uid() IS NOT NULL) 
  AND (auth.uid() = client_id) 
  AND (status = 'pending'::booking_status)
)
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND (auth.uid() = client_id) 
  AND (status = 'pending'::booking_status)
);

-- Update facilities policies for better security
DROP POLICY IF EXISTS "Authenticated users can create facilities" ON public.facilities;

CREATE POLICY "Authenticated users can create facilities" 
ON public.facilities 
FOR INSERT 
TO authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL) 
  AND (auth.uid() = owner_id) 
  AND (has_role('client'::user_role) OR has_role('facility_owner'::user_role) OR has_role('admin'::user_role))
);

-- Update facility owners and admins update policy
DROP POLICY IF EXISTS "Facility owners and admins can update facilities" ON public.facilities;

CREATE POLICY "Facility owners and admins can update facilities" 
ON public.facilities 
FOR UPDATE 
TO authenticated
USING ((auth.uid() = owner_id) OR has_role('admin'::user_role))
WITH CHECK ((auth.uid() = owner_id) OR has_role('admin'::user_role));

-- Update bank details policies
DROP POLICY IF EXISTS "Users can insert their own bank details" ON public.bank_details;
DROP POLICY IF EXISTS "Users can update their own bank details" ON public.bank_details;

CREATE POLICY "Users can insert their own bank details" 
ON public.bank_details 
FOR INSERT 
TO authenticated
WITH CHECK ((auth.uid() IS NOT NULL) AND ((auth.uid() = user_id) OR has_role('admin'::user_role)));

CREATE POLICY "Users can update their own bank details" 
ON public.bank_details 
FOR UPDATE 
TO authenticated
USING ((auth.uid() = user_id) OR has_role('admin'::user_role))
WITH CHECK ((auth.uid() = user_id) OR has_role('admin'::user_role));