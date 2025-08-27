-- Fix Critical Security Issues

-- 1. Lock down facilities table - remove public SELECT and fix RLS policies
DROP POLICY IF EXISTS "Allow public viewing of active facilities" ON public.facilities;
DROP POLICY IF EXISTS "Allow authenticated users to create facilities" ON public.facilities;

-- Create new secure RLS policies for facilities
CREATE POLICY "Facility owners can view their own facilities" 
ON public.facilities 
FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all facilities" 
ON public.facilities 
FOR SELECT 
USING (has_role('admin'::user_role));

CREATE POLICY "Authenticated users can create facilities" 
ON public.facilities 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id AND auth.uid() IS NOT NULL);

-- 2. Fix SECURITY DEFINER functions to prevent search_path hijacking
CREATE OR REPLACE FUNCTION public.get_owner_facility_details()
RETURNS TABLE(id uuid, owner_id uuid, name text, description text, facility_type facility_type, full_address text, city text, exact_price_per_hour numeric, exact_capacity integer, exact_capacity_max integer, amenities text[], images text[], main_image_url text, is_active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.owner_id,
    f.name,
    f.description,
    f.facility_type,
    f.address as full_address,
    f.city,
    f.price_per_hour as exact_price_per_hour,
    f.capacity as exact_capacity,
    f.capacity_max as exact_capacity_max,
    f.amenities,
    f.images,
    f.main_image_url,
    f.is_active,
    f.created_at,
    f.updated_at
  FROM facilities f
  WHERE f.owner_id = auth.uid()
  ORDER BY f.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_booking_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 3. Add missing database triggers for booking integrity
CREATE TRIGGER trigger_validate_booking_security
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_security();

CREATE TRIGGER trigger_prevent_booking_overlap
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();

CREATE TRIGGER trigger_protect_booking_integrity
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_integrity();

CREATE TRIGGER trigger_update_booking_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_client_booking_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_client_booking_stats();

CREATE TRIGGER trigger_update_facility_updated_at
  BEFORE UPDATE ON public.facilities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add storage policies for facility-images bucket
CREATE POLICY "Users can upload to their own facility images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'facility-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own facility images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'facility-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own facility images"
ON storage.objects
FOR DELETE
USING (bucket_id = 'facility-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view facility images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'facility-images');