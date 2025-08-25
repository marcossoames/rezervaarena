-- Create a table to track payments and what needs to be distributed
CREATE TABLE public.platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  facility_owner_id UUID NOT NULL,
  client_id UUID NOT NULL,
  stripe_session_id TEXT UNIQUE,
  total_amount NUMERIC NOT NULL,
  platform_fee_amount NUMERIC NOT NULL DEFAULT 0,
  facility_owner_amount NUMERIC NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  distributed_status TEXT DEFAULT 'pending', -- pending, distributed, failed
  distributed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

-- Admin can see all payments
CREATE POLICY "Admins can manage all platform payments" 
ON public.platform_payments 
FOR ALL 
USING (has_role('admin'::user_role));

-- Facility owners can see payments for their facilities
CREATE POLICY "Facility owners can view their payments" 
ON public.platform_payments 
FOR SELECT 
USING (facility_owner_id = auth.uid());

-- Clients can see their payments
CREATE POLICY "Clients can view their payments" 
ON public.platform_payments 
FOR SELECT 
USING (client_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_platform_payments_updated_at
BEFORE UPDATE ON public.platform_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();