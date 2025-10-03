-- Add daily_hours column to facilities table
-- Structure: {0: {start: "08:00", end: "22:00", closed: false}, 1: {...}, ..., 6: {...}}
-- Keys 0-6 represent Monday-Sunday
ALTER TABLE public.facilities 
ADD COLUMN daily_hours JSONB DEFAULT NULL;

-- Populate existing facilities with their current operating hours for all days
UPDATE public.facilities
SET daily_hours = jsonb_build_object(
  '0', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '1', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '2', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '3', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '4', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '5', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false),
  '6', jsonb_build_object('start', operating_hours_start::text, 'end', operating_hours_end::text, 'closed', false)
)
WHERE daily_hours IS NULL;

-- Add comment to explain the structure
COMMENT ON COLUMN public.facilities.daily_hours IS 'Daily operating hours: {0-6: {start: "HH:MM", end: "HH:MM", closed: boolean}} where 0=Monday, 6=Sunday';