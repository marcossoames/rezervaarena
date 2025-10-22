-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule 24-hour reminder job (runs every hour)
-- This will check for bookings that are 24 hours away and send reminders
SELECT cron.schedule(
  'send-24h-booking-reminders',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://ukopxkymzywfpobpcana.supabase.co/functions/v1/send-booking-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3B4a3ltenl3ZnBvYnBjYW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MTI4MzAsImV4cCI6MjA3MTM4ODgzMH0.GL1gd0IkKn-_r9wVG4omebQb8Pivq0_FjNDlR6LcLIc"}'::jsonb,
        body:='{"type": "24h"}'::jsonb
    ) as request_id;
  $$
);

-- Schedule 1-hour reminder job (runs every 10 minutes for better accuracy)
-- This will check for bookings that are approximately 1 hour away
SELECT cron.schedule(
  'send-1h-booking-reminders',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ukopxkymzywfpobpcana.supabase.co/functions/v1/send-booking-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3B4a3ltenl3ZnBvYnBjYW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MTI4MzAsImV4cCI6MjA3MTM4ODgzMH0.GL1gd0IkKn-_r9wVG4omebQb8Pivq0_FjNDlR6LcLIc"}'::jsonb,
        body:='{"type": "1h"}'::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
-- SELECT * FROM cron.job;