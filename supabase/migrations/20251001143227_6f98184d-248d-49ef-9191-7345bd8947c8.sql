-- Allow unauthenticated users to view blocked dates (read-only for calendar display)
CREATE POLICY "Public can view blocked dates for calendar display" 
ON public.blocked_dates 
FOR SELECT 
USING (true);