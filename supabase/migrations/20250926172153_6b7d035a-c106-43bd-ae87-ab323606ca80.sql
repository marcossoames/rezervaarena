-- Add allowed_durations column to facilities table
-- This will store the allowed booking durations in minutes (60, 90, 120)
ALTER TABLE public.facilities 
ADD COLUMN allowed_durations integer[] DEFAULT '{60, 90, 120}';

-- Add comment to explain the column
COMMENT ON COLUMN public.facilities.allowed_durations IS 'Allowed booking durations in minutes (e.g., {60, 90, 120})';

-- Update existing facilities to have all durations by default
UPDATE public.facilities 
SET allowed_durations = '{60, 90, 120}' 
WHERE allowed_durations IS NULL;