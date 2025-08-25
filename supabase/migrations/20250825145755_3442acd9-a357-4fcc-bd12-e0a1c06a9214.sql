-- Create function to update client statistics when booking status changes
CREATE OR REPLACE FUNCTION public.update_client_booking_stats()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking statistics
CREATE TRIGGER update_client_booking_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_booking_stats();

-- Initialize existing statistics (run once to populate current data)
WITH booking_stats AS (
  SELECT 
    client_id,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'no_show') as no_show,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
  FROM public.bookings
  GROUP BY client_id
)
UPDATE public.profiles
SET 
  total_bookings = COALESCE(booking_stats.total, 0),
  completed_bookings = COALESCE(booking_stats.completed, 0),
  no_show_bookings = COALESCE(booking_stats.no_show, 0),
  cancelled_bookings = COALESCE(booking_stats.cancelled, 0)
FROM booking_stats
WHERE profiles.user_id = booking_stats.client_id;