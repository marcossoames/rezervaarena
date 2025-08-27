-- Update the facility_type enum to include new sports and remove swimming
-- First drop the constraint/references if any
ALTER TABLE facilities ALTER COLUMN facility_type TYPE text;

-- Drop the old enum
DROP TYPE IF EXISTS facility_type;

-- Create new enum with updated values
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

-- Update the facility_type column to use the new enum
ALTER TABLE facilities ALTER COLUMN facility_type TYPE facility_type USING facility_type::facility_type;

-- Update any existing "swimming" records to "squash"
UPDATE facilities SET facility_type = 'squash' WHERE facility_type::text = 'swimming';