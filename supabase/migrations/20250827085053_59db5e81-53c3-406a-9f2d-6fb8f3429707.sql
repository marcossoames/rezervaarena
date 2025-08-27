-- Step 1: Drop and recreate all functions that depend on facility_type enum
-- This allows us to modify the enum safely

DROP FUNCTION IF EXISTS get_public_facilities();
DROP FUNCTION IF EXISTS get_owner_facility_details();
DROP FUNCTION IF EXISTS register_facility_with_profile(uuid,text,text,text,text,text,facility_type,text,text,numeric,integer,text[]);
DROP FUNCTION IF EXISTS get_facility_stats_by_type();
DROP FUNCTION IF EXISTS get_facilities_for_booking();
DROP FUNCTION IF EXISTS get_facilities_for_public_browsing_safe();
DROP FUNCTION IF EXISTS get_facilities_for_authenticated_users();
DROP FUNCTION IF EXISTS register_facility_with_profile_secure(text,text,text,text,text,facility_type,text,text,numeric,integer,text[]);

-- Step 2: Convert facility_type column to text temporarily
ALTER TABLE facilities ALTER COLUMN facility_type TYPE text;

-- Step 3: Update any existing "swimming" records to "squash"
UPDATE facilities SET facility_type = 'squash' WHERE facility_type = 'swimming';

-- Step 4: Drop and recreate the enum with new values
DROP TYPE facility_type;
CREATE TYPE facility_type AS ENUM (
  'tennis',
  'football', 
  'padel',
  'squash',
  'basketball',
  'volleyball',
  'ping_pong',
  'foot_tennis'
);

-- Step 5: Convert the column back to use the new enum
ALTER TABLE facilities ALTER COLUMN facility_type TYPE facility_type USING facility_type::facility_type;