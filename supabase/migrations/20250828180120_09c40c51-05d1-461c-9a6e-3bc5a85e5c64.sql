-- Fix remaining security issues from linter

-- 1. Fix function search path issues for remaining functions
CREATE OR REPLACE FUNCTION public.audit_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Log role changes for security monitoring
  IF TG_OP = 'UPDATE' AND OLD.role != NEW.role THEN
    INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
    VALUES (
      auth.uid(),
      'role_change',
      NEW.user_id,
      NEW.email,
      jsonb_build_object(
        'old_role', OLD.role,
        'new_role', NEW.role,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_facilities_for_booking()
RETURNS TABLE(id uuid, name text, facility_type facility_type, city text, area_info text, description text, price_per_hour numeric, capacity integer, capacity_max integer, amenities text[], images text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  -- Enhanced data for authenticated users - show exact pricing and capacity for booking decisions
  SELECT 
    f.id,
    f.name,
    f.facility_type,
    f.city,
    -- Show general area without exact address for security
    f.city || ' area' as area_info,
    -- Show full description for informed decisions
    f.description,
    -- Show exact pricing for booking calculations
    f.price_per_hour,
    -- Show exact capacity for group planning
    f.capacity,
    f.capacity_max,
    -- Show all amenities to highlight facility features
    f.amenities,
    -- Show images for visual decision making
    f.images
  FROM facilities f
  WHERE f.is_active = true
    AND auth.uid() IS NOT NULL  -- Only for authenticated users
  ORDER BY f.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_facility_stats_by_type()
RETURNS TABLE(facility_type facility_type, facility_count bigint, min_price numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    f.facility_type,
    COUNT(*) as facility_count,
    MIN(f.price_per_hour) as min_price
  FROM facilities f
  WHERE f.is_active = true
  GROUP BY f.facility_type
  ORDER BY f.facility_type;
$function$;

CREATE OR REPLACE FUNCTION public.update_client_booking_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Handle status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Decrease old status count
    CASE OLD.status
      WHEN 'completed' THEN
        UPDATE public.profiles 
        SET completed_bookings = GREATEST(completed_bookings - 1, 0)
        WHERE user_id = NEW.client_id;
      WHEN 'no_show' THEN
        UPDATE public.profiles 
        SET no_show_bookings = GREATEST(no_show_bookings - 1, 0)
        WHERE user_id = NEW.client_id;
      WHEN 'cancelled' THEN
        UPDATE public.profiles 
        SET cancelled_bookings = GREATEST(cancelled_bookings - 1, 0)
        WHERE user_id = NEW.client_id;
      ELSE
        -- No action for pending/confirmed
    END CASE;
    
    -- Increase new status count
    CASE NEW.status
      WHEN 'completed' THEN
        UPDATE public.profiles 
        SET completed_bookings = completed_bookings + 1
        WHERE user_id = NEW.client_id;
      WHEN 'no_show' THEN
        UPDATE public.profiles 
        SET no_show_bookings = no_show_bookings + 1
        WHERE user_id = NEW.client_id;
      WHEN 'cancelled' THEN
        UPDATE public.profiles 
        SET cancelled_bookings = cancelled_bookings + 1
        WHERE user_id = NEW.client_id;
      ELSE
        -- No action for pending/confirmed
    END CASE;
  END IF;
  
  -- Handle new booking insertion
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles 
    SET total_bookings = total_bookings + 1
    WHERE user_id = NEW.client_id;
    
    -- If booking is immediately marked as completed/no_show/cancelled
    CASE NEW.status
      WHEN 'completed' THEN
        UPDATE public.profiles 
        SET completed_bookings = completed_bookings + 1
        WHERE user_id = NEW.client_id;
      WHEN 'no_show' THEN
        UPDATE public.profiles 
        SET no_show_bookings = no_show_bookings + 1
        WHERE user_id = NEW.client_id;
      WHEN 'cancelled' THEN
        UPDATE public.profiles 
        SET cancelled_bookings = cancelled_bookings + 1
        WHERE user_id = NEW.client_id;
      ELSE
        -- No action for pending/confirmed
    END CASE;
  END IF;
  
  -- Handle booking deletion
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles 
    SET total_bookings = GREATEST(total_bookings - 1, 0)
    WHERE user_id = OLD.client_id;
    
    CASE OLD.status
      WHEN 'completed' THEN
        UPDATE public.profiles 
        SET completed_bookings = GREATEST(completed_bookings - 1, 0)
        WHERE user_id = OLD.client_id;
      WHEN 'no_show' THEN
        UPDATE public.profiles 
        SET no_show_bookings = GREATEST(no_show_bookings - 1, 0)
        WHERE user_id = OLD.client_id;
      WHEN 'cancelled' THEN
        UPDATE public.profiles 
        SET cancelled_bookings = GREATEST(cancelled_bookings - 1, 0)
        WHERE user_id = OLD.client_id;
      ELSE
        -- No action for pending/confirmed
    END CASE;
    
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_user_account_secure(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  target_email text;
  facility_count integer;
  booking_count integer;
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role('admin'::user_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;
  
  -- Get target user email and count related data before deletion
  SELECT email INTO target_email FROM public.profiles WHERE user_id = _user_id;
  SELECT COUNT(*) INTO facility_count FROM facilities WHERE owner_id = _user_id;
  SELECT COUNT(*) INTO booking_count FROM bookings WHERE client_id = _user_id;
  
  -- Log the action before deletion with metadata about what will be deleted
  INSERT INTO public.admin_audit_logs (admin_user_id, action, target_user_id, target_user_email, metadata)
  VALUES (
    auth.uid(),
    'delete_user_account',
    _user_id,
    target_email,
    jsonb_build_object(
      'timestamp', now(),
      'facilities_deleted', facility_count,
      'bookings_deleted', booking_count
    )
  );
  
  -- Delete user facilities first (this will cascade to facility_images, facility_services, blocked_dates)
  DELETE FROM public.facilities WHERE owner_id = _user_id;
  
  -- Delete user bookings
  DELETE FROM public.bookings WHERE client_id = _user_id;
  
  -- Delete from profiles table
  DELETE FROM public.profiles WHERE user_id = _user_id;
  
  -- Delete from auth.users (this should cascade properly)
  DELETE FROM auth.users WHERE id = _user_id;
  
  RETURN FOUND;
END;
$function$;