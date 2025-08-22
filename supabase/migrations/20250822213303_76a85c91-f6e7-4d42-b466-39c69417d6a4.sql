-- Update existing facilities with sample images from assets
UPDATE facilities 
SET images = ARRAY[
  CASE 
    WHEN facility_type = 'football' THEN '/src/assets/football-field.jpg'
    WHEN facility_type = 'basketball' THEN '/src/assets/basketball-court.jpg'
    WHEN facility_type = 'tennis' THEN '/src/assets/tennis-court.jpg'
    WHEN facility_type = 'padel' THEN '/src/assets/padel-court.jpg'
    WHEN facility_type = 'swimming' THEN '/src/assets/swimming-pool.jpg'
    WHEN facility_type = 'volleyball' THEN '/src/assets/volleyball-court.jpg'
    ELSE '/placeholder.svg'
  END
]
WHERE images IS NULL OR array_length(images, 1) IS NULL;

-- Update existing facilities with better descriptions and amenities
UPDATE facilities 
SET 
  description = CASE 
    WHEN facility_type = 'football' THEN 'Teren de fotbal profesional cu gazon sintetic de ultima generație. Ideal pentru meciuri și antrenamente.'
    WHEN facility_type = 'basketball' THEN 'Sală de baschet modernă cu podea de înaltă calitate și echipament profesional.'
    ELSE description
  END,
  amenities = CASE 
    WHEN facility_type = 'football' THEN ARRAY['Gazon sintetic', 'Vestiare', 'Parcare', 'Iluminat nocturn']
    WHEN facility_type = 'basketball' THEN ARRAY['Podea profesională', 'Vestiare', 'Aer condiționat', 'Parcare']
    ELSE COALESCE(amenities, ARRAY[]::text[])
  END
WHERE facility_type IN ('football', 'basketball');