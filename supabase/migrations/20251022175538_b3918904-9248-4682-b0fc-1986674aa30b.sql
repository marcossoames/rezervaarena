-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('booking_confirmed', 'booking_cancelled', 'booking_reminder_24h', 'booking_reminder_1h', 'new_article')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster queries
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Trigger: Create notification when booking is confirmed
CREATE OR REPLACE FUNCTION public.notify_booking_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_name TEXT;
  booking_date_formatted TEXT;
BEGIN
  -- Only trigger on new confirmed bookings or status change to confirmed
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmed') OR 
     (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
    
    -- Get facility name
    SELECT name INTO facility_name FROM public.facilities WHERE id = NEW.facility_id;
    
    -- Format date
    booking_date_formatted := TO_CHAR(NEW.booking_date, 'DD.MM.YYYY');
    
    -- Create notification for client
    PERFORM public.create_notification(
      NEW.client_id,
      'booking_confirmed',
      'Rezervare confirmată',
      'Rezervarea ta la ' || facility_name || ' pe data de ' || booking_date_formatted || ' a fost confirmată.',
      '/my-reservations',
      jsonb_build_object('booking_id', NEW.id, 'facility_id', NEW.facility_id)
    );
    
    -- Create notification for facility owner
    DECLARE
      owner_id UUID;
    BEGIN
      SELECT f.owner_id INTO owner_id FROM public.facilities f WHERE f.id = NEW.facility_id;
      
      PERFORM public.create_notification(
        owner_id,
        'booking_confirmed',
        'Rezervare nouă',
        'Ai o rezervare nouă pentru ' || facility_name || ' pe data de ' || booking_date_formatted || '.',
        '/facility-owner-bookings',
        jsonb_build_object('booking_id', NEW.id, 'facility_id', NEW.facility_id)
      );
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_booking_confirmed
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_confirmed();

-- Trigger: Create notification when booking is cancelled
CREATE OR REPLACE FUNCTION public.notify_booking_cancelled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  facility_name TEXT;
  booking_date_formatted TEXT;
  owner_id UUID;
BEGIN
  -- Only trigger on status change to cancelled
  IF TG_OP = 'UPDATE' AND OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    
    -- Get facility name and owner
    SELECT f.name, f.owner_id INTO facility_name, owner_id 
    FROM public.facilities f WHERE f.id = NEW.facility_id;
    
    -- Format date
    booking_date_formatted := TO_CHAR(NEW.booking_date, 'DD.MM.YYYY');
    
    -- Create notification for client
    PERFORM public.create_notification(
      NEW.client_id,
      'booking_cancelled',
      'Rezervare anulată',
      'Rezervarea ta la ' || facility_name || ' pe data de ' || booking_date_formatted || ' a fost anulată.',
      '/my-reservations',
      jsonb_build_object('booking_id', NEW.id, 'facility_id', NEW.facility_id)
    );
    
    -- Create notification for facility owner
    PERFORM public.create_notification(
      owner_id,
      'booking_cancelled',
      'Rezervare anulată',
      'O rezervare pentru ' || facility_name || ' pe data de ' || booking_date_formatted || ' a fost anulată.',
      '/facility-owner-bookings',
      jsonb_build_object('booking_id', NEW.id, 'facility_id', NEW.facility_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_booking_cancelled
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_cancelled();

-- Trigger: Create notification when new article is published
CREATE OR REPLACE FUNCTION public.notify_new_article()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger for new published articles
  IF TG_OP = 'INSERT' AND NEW.is_published = true THEN
    -- Notify all users about new article (will be handled by edge function for mass notification)
    -- For now, we'll create a special notification that the edge function can detect
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    SELECT 
      p.user_id,
      'new_article',
      'Articol nou: ' || NEW.title,
      SUBSTRING(NEW.content FROM 1 FOR 150) || '...',
      '/articles',
      jsonb_build_object('article_id', NEW.id)
    FROM public.profiles p
    WHERE p.user_id IS NOT NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_article
  AFTER INSERT ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_article();