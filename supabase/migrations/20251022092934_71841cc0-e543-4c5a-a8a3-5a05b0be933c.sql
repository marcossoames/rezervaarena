-- Add promotion_only column to facilities table
ALTER TABLE public.facilities 
ADD COLUMN promotion_only boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.facilities.promotion_only IS 'When true, facility is visible but clients cannot book online - they must call';