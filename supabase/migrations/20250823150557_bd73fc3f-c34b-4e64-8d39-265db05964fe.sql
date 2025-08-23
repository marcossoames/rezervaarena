-- Add operating hours and blocked time slots to facilities table
ALTER TABLE public.facilities 
ADD COLUMN operating_hours_start time DEFAULT '08:00:00',
ADD COLUMN operating_hours_end time DEFAULT '22:00:00';

-- Create blocked_dates table for facility calendar blocking
CREATE TABLE public.blocked_dates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facility_id uuid NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  start_time time,
  end_time time,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  UNIQUE(facility_id, blocked_date, start_time, end_time)
);

-- Enable RLS on blocked_dates
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;

-- Create policies for blocked_dates
CREATE POLICY "Facility owners can manage their blocked dates" 
ON public.blocked_dates 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.facilities f 
    WHERE f.id = blocked_dates.facility_id 
    AND f.owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all blocked dates" 
ON public.blocked_dates 
FOR ALL 
USING (has_role('admin'::user_role));

CREATE POLICY "Anyone can view blocked dates for booking purposes" 
ON public.blocked_dates 
FOR SELECT 
USING (true);

-- Add index for better performance
CREATE INDEX idx_blocked_dates_facility_date ON public.blocked_dates(facility_id, blocked_date);