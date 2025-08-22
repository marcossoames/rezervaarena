-- Revert facilities back to original data
UPDATE facilities 
SET 
  images = NULL,
  description = CASE 
    WHEN id = '2e73312b-caff-450e-acfd-1d986f4c2ae9' THEN 'test1'
    WHEN id = '24d80cab-791b-48c1-98e0-1525cc465307' THEN 'test2'
    ELSE description
  END,
  amenities = ARRAY[]::text[]
WHERE id IN ('2e73312b-caff-450e-acfd-1d986f4c2ae9', '24d80cab-791b-48c1-98e0-1525cc465307');