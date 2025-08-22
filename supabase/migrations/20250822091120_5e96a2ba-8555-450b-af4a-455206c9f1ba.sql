-- Delete all existing data from tables
DELETE FROM public.bookings;
DELETE FROM public.facilities;

-- Reset sequences if needed (though we use UUIDs, this is for completeness)
-- No need to reset UUID sequences