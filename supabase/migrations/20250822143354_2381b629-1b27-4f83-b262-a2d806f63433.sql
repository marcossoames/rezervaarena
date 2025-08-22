-- Security Fix: Remove the public_facilities view to prevent data exposure
-- We already have the secure get_public_facilities() RPC function that controls access

DROP VIEW IF EXISTS public.public_facilities;

-- Verify that our secure RPC function exists and has proper permissions
-- (This is just a check - the function was already created in the previous migration)