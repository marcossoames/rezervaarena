-- Add unique constraint on sports_complexes owner_id to prevent duplicates
ALTER TABLE public.sports_complexes 
ADD CONSTRAINT sports_complexes_owner_id_unique UNIQUE (owner_id);