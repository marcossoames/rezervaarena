-- Add WITH CHECK clauses to RLS policies to prevent data hijacking

-- Fix bookings table policies
DROP POLICY IF EXISTS "Clients can create bookings" ON public.bookings;
CREATE POLICY "Clients can create bookings" ON public.bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Clients can update their pending bookings" ON public.bookings;
CREATE POLICY "Clients can update their pending bookings" ON public.bookings
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = client_id) AND (status = 'pending'::booking_status))
  WITH CHECK ((auth.uid() = client_id) AND (status = 'pending'::booking_status));

DROP POLICY IF EXISTS "Facility owners can update bookings for their facilities" ON public.bookings;
CREATE POLICY "Facility owners can update bookings for their facilities" ON public.bookings
  FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM facilities WHERE facilities.id = bookings.facility_id AND facilities.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM facilities WHERE facilities.id = bookings.facility_id AND facilities.owner_id = auth.uid()));

-- Fix articles table policies
DROP POLICY IF EXISTS "Admins can manage all articles" ON public.articles;
CREATE POLICY "Admins can manage all articles" ON public.articles
  FOR ALL
  TO authenticated
  USING (has_role('admin'::user_role))
  WITH CHECK (has_role('admin'::user_role));

-- Fix bank_details table policies
DROP POLICY IF EXISTS "Users can insert their own bank details" ON public.bank_details;
CREATE POLICY "Users can insert their own bank details" ON public.bank_details
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR has_role('admin'::user_role));

DROP POLICY IF EXISTS "Users can update their own bank details" ON public.bank_details;
CREATE POLICY "Users can update their own bank details" ON public.bank_details
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id) OR has_role('admin'::user_role))
  WITH CHECK ((auth.uid() = user_id) OR has_role('admin'::user_role));

-- Fix blocked_dates table policies
DROP POLICY IF EXISTS "Facility owners can manage their blocked dates" ON public.blocked_dates;
CREATE POLICY "Facility owners can manage their blocked dates" ON public.blocked_dates
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM facilities f WHERE f.id = blocked_dates.facility_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM facilities f WHERE f.id = blocked_dates.facility_id AND f.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all blocked dates" ON public.blocked_dates;
CREATE POLICY "Admins can manage all blocked dates" ON public.blocked_dates
  FOR ALL
  TO authenticated
  USING (has_role('admin'::user_role))
  WITH CHECK (has_role('admin'::user_role));

-- Fix facility_images table policies
DROP POLICY IF EXISTS "Facility owners can manage their facility images" ON public.facility_images;
CREATE POLICY "Facility owners can manage their facility images" ON public.facility_images
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM facilities f WHERE f.id = facility_images.facility_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM facilities f WHERE f.id = facility_images.facility_id AND f.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all facility images" ON public.facility_images;
CREATE POLICY "Admins can manage all facility images" ON public.facility_images
  FOR ALL
  TO authenticated
  USING (has_role('admin'::user_role))
  WITH CHECK (has_role('admin'::user_role));

-- Fix facility_services table policies
DROP POLICY IF EXISTS "Facility owners can manage their facility services" ON public.facility_services;
CREATE POLICY "Facility owners can manage their facility services" ON public.facility_services
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM facilities f WHERE f.id = facility_services.facility_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM facilities f WHERE f.id = facility_services.facility_id AND f.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage all facility services" ON public.facility_services;
CREATE POLICY "Admins can manage all facility services" ON public.facility_services
  FOR ALL
  TO authenticated
  USING (has_role('admin'::user_role))
  WITH CHECK (has_role('admin'::user_role));

-- Create BEFORE UPDATE trigger to prevent unauthorized changes to sensitive booking fields
CREATE OR REPLACE FUNCTION public.protect_booking_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only allow admins to modify critical financial fields
  IF NOT has_role('admin'::user_role) THEN
    -- Prevent changes to calculated amounts
    IF OLD.total_price != NEW.total_price OR 
       OLD.total_amount != NEW.total_amount OR
       OLD.platform_fee_amount != NEW.platform_fee_amount OR
       OLD.facility_owner_amount != NEW.facility_owner_amount THEN
      RAISE EXCEPTION 'Only admins can modify financial calculations';
    END IF;
    
    -- Prevent changes to Stripe IDs
    IF OLD.stripe_session_id != NEW.stripe_session_id OR
       OLD.stripe_payment_intent_id != NEW.stripe_payment_intent_id OR
       OLD.stripe_charge_id != NEW.stripe_charge_id THEN
      RAISE EXCEPTION 'Only admins can modify Stripe identifiers';
    END IF;
    
    -- Prevent changes to client_id and facility_id
    IF OLD.client_id != NEW.client_id OR OLD.facility_id != NEW.facility_id THEN
      RAISE EXCEPTION 'Cannot change booking ownership or facility';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach the protection trigger
DROP TRIGGER IF EXISTS protect_booking_integrity_trigger ON public.bookings;
CREATE TRIGGER protect_booking_integrity_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_booking_integrity();

-- Add storage RLS policies for facility-images bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('facility-images', 'facility-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for facility-images
CREATE POLICY "Facility owners can upload images for their facilities" 
ON storage.objects 
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Facility owners can update images for their facilities" 
ON storage.objects 
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
)
WITH CHECK (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Facility owners can delete images for their facilities" 
ON storage.objects 
FOR DELETE 
TO authenticated
USING (
  bucket_id = 'facility-images' AND 
  EXISTS (
    SELECT 1 FROM facilities f 
    WHERE f.owner_id = auth.uid() 
    AND (storage.foldername(name))[1] = f.id::text
  )
);

CREATE POLICY "Admins can manage all facility images in storage" 
ON storage.objects 
FOR ALL 
TO authenticated
USING (bucket_id = 'facility-images' AND has_role('admin'::user_role))
WITH CHECK (bucket_id = 'facility-images' AND has_role('admin'::user_role));

CREATE POLICY "Public can view facility images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'facility-images');