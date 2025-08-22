-- Security fixes migration

-- 1. Fix has_role function security hardening
CREATE OR REPLACE FUNCTION public.has_role(_role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND role = _role
  )
$function$;

-- 2. Add unique constraint on profiles.user_id for consistency
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- 3. Add trigger to ensure profile creation on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Tighten facilities RLS - Remove client direct access policy
DROP POLICY IF EXISTS "Clients can view basic facility info for booking" ON public.facilities;

-- Create more restrictive client access that only works through RPC
CREATE POLICY "Clients can only access facilities through RPC" 
ON public.facilities 
FOR SELECT 
USING (
  -- Only allow if called from within a SECURITY DEFINER function context
  -- This effectively blocks direct table access from clients
  false
);

-- 5. Fix storage policies for facility-images bucket
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can upload their own facility images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own facility images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own facility images" ON storage.objects;

-- Create new policies that check facility ownership
CREATE POLICY "Facility owners can upload images for their facilities" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = (storage.foldername(name))[1]::uuid
      AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can update images for their facilities" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = (storage.foldername(name))[1]::uuid
      AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Facility owners can delete images for their facilities" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'facility-images' 
  AND EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = (storage.foldername(name))[1]::uuid
      AND f.owner_id = auth.uid()
  )
);

-- Keep the public read policy as is for client viewing
-- (This should already exist but ensuring it's correct)
CREATE POLICY "Facility images are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');

-- 6. Add server-side data validation constraints
ALTER TABLE public.facilities 
ADD CONSTRAINT price_must_be_positive 
CHECK (price_per_hour > 0);

ALTER TABLE public.facilities 
ADD CONSTRAINT capacity_must_be_positive 
CHECK (capacity > 0);

-- 7. Add booking overlap prevention function
CREATE OR REPLACE FUNCTION public.check_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check for overlapping bookings on the same facility and date
  IF EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE facility_id = NEW.facility_id 
      AND booking_date = NEW.booking_date
      AND status IN ('confirmed', 'pending')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Booking time overlaps with existing booking';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Add trigger for booking overlap checking
CREATE TRIGGER check_booking_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.check_booking_overlap();