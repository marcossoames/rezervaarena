-- Create a trigger to automatically populate facility information in bookings
-- This ensures all future bookings preserve facility data

CREATE OR REPLACE FUNCTION public.populate_booking_facility_info()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Populate facility_name and facility_address from the facilities table
  IF NEW.facility_name IS NULL OR NEW.facility_address IS NULL THEN
    UPDATE public.bookings 
    SET 
      facility_name = f.name,
      facility_address = f.address
    FROM public.facilities f
    WHERE bookings.id = NEW.id 
      AND f.id = NEW.facility_id
      AND (bookings.facility_name IS NULL OR bookings.facility_address IS NULL);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger for INSERT operations
DROP TRIGGER IF EXISTS populate_booking_facility_info_trigger ON public.bookings;
CREATE TRIGGER populate_booking_facility_info_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_booking_facility_info();