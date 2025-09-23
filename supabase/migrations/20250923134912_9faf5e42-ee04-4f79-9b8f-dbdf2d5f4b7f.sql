-- Add recurring blocking functionality for entire days (fixed)
-- Create a new table for recurring blocked dates (weekly patterns)
CREATE TABLE IF NOT EXISTS public.recurring_blocked_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 1 = Monday, etc.
  start_date DATE NOT NULL,
  end_date DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(facility_id, day_of_week, start_date)
);

-- Enable RLS
ALTER TABLE public.recurring_blocked_dates ENABLE ROW LEVEL SECURITY;

-- Create policies for recurring blocked dates
CREATE POLICY "Authenticated admins can manage all recurring blocked dates"
ON public.recurring_blocked_dates
FOR ALL
TO authenticated
USING ((auth.uid() IS NOT NULL) AND has_role('admin'::user_role))
WITH CHECK ((auth.uid() IS NOT NULL) AND has_role('admin'::user_role));

CREATE POLICY "Authenticated facility owners can manage their recurring blocked dates"
ON public.recurring_blocked_dates
FOR ALL
TO authenticated
USING ((auth.uid() IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM facilities f
  WHERE f.id = recurring_blocked_dates.facility_id 
  AND f.owner_id = auth.uid()
)))
WITH CHECK ((auth.uid() IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM facilities f
  WHERE f.id = recurring_blocked_dates.facility_id 
  AND f.owner_id = auth.uid()
)));

CREATE POLICY "Authenticated users can view recurring blocked dates for booking"
ON public.recurring_blocked_dates
FOR SELECT
TO authenticated
USING ((auth.uid() IS NOT NULL) AND (EXISTS (
  SELECT 1 FROM facilities f
  WHERE f.id = recurring_blocked_dates.facility_id 
  AND f.is_active = true
)));

-- Function to generate blocked dates from recurring patterns (fixed variable name)
CREATE OR REPLACE FUNCTION generate_blocked_dates_from_recurring()
RETURNS TRIGGER AS $$
DECLARE
  processing_date DATE;
  target_day INTEGER;
  days_to_add INTEGER;
BEGIN
  -- Generate blocked dates for the next 6 months from start_date
  processing_date := NEW.start_date;
  
  -- Find the first occurrence of the target day of week
  target_day := NEW.day_of_week;
  days_to_add := (target_day - EXTRACT(DOW FROM processing_date)::INTEGER + 7) % 7;
  processing_date := processing_date + days_to_add;
  
  -- Generate entries until end_date or 6 months, whichever comes first
  WHILE processing_date <= COALESCE(NEW.end_date, processing_date + INTERVAL '6 months') LOOP
    -- Insert into blocked_dates if not already exists
    INSERT INTO public.blocked_dates (
      facility_id,
      blocked_date,
      start_time,
      end_time,
      reason,
      created_by
    )
    VALUES (
      NEW.facility_id,
      processing_date,
      NULL, -- NULL means entire day is blocked
      NULL,
      COALESCE(NEW.reason, 'Blocaj recurent'),
      NEW.created_by
    )
    ON CONFLICT (facility_id, blocked_date) WHERE start_time IS NULL AND end_time IS NULL
    DO NOTHING; -- Don't duplicate full day blocks
    
    -- Move to next week
    processing_date := processing_date + INTERVAL '7 days';
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate blocked dates
CREATE TRIGGER trigger_generate_blocked_dates
  AFTER INSERT ON public.recurring_blocked_dates
  FOR EACH ROW
  EXECUTE FUNCTION generate_blocked_dates_from_recurring();