-- Allow clients to cancel their own bookings via RLS
DO $$
BEGIN
  -- Create policy to allow clients to set status to 'cancelled' on their own bookings
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'bookings' 
      AND policyname = 'Authenticated clients can cancel their own bookings'
  ) THEN
    CREATE POLICY "Authenticated clients can cancel their own bookings"
    ON public.bookings
    FOR UPDATE
    USING (
      auth.uid() IS NOT NULL AND auth.uid() = client_id
    )
    WITH CHECK (
      auth.uid() IS NOT NULL AND auth.uid() = client_id AND NEW.status = 'cancelled'::booking_status
    );
  END IF;
END $$;