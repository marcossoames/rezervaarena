-- Enable real-time for blocked_dates and recurring_blocked_dates tables
ALTER TABLE public.blocked_dates REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_blocked_dates REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_dates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recurring_blocked_dates;