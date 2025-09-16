-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Only authenticated users can view published articles" ON public.articles;

-- Create new policy allowing public access to published articles
CREATE POLICY "Anyone can view published articles" 
ON public.articles 
FOR SELECT 
USING (is_published = true);