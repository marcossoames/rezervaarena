-- Add capacity_max field to facilities table to support capacity ranges
ALTER TABLE public.facilities 
ADD COLUMN capacity_max integer;

-- Add a comment to clarify the capacity system
COMMENT ON COLUMN public.facilities.capacity IS 'Minimum capacity or fixed capacity if capacity_max is NULL';
COMMENT ON COLUMN public.facilities.capacity_max IS 'Maximum capacity for ranges. NULL means fixed capacity';

-- Add a check constraint to ensure capacity_max is greater than capacity when specified
ALTER TABLE public.facilities 
ADD CONSTRAINT check_capacity_range 
CHECK (capacity_max IS NULL OR capacity_max > capacity);