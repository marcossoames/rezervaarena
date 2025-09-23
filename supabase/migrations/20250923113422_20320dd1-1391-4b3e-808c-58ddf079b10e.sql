-- Create a table to store pending cancellation emails
CREATE TABLE IF NOT EXISTS public.pending_cancellation_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ids uuid[],
  client_emails text[],
  facility_names text[],
  reason text,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE public.pending_cancellation_emails ENABLE ROW LEVEL SECURITY;

-- Create policy for admins only
CREATE POLICY "Only admins can access pending cancellation emails" ON public.pending_cancellation_emails
FOR ALL TO authenticated
USING (has_role('admin'::user_role))
WITH CHECK (has_role('admin'::user_role));