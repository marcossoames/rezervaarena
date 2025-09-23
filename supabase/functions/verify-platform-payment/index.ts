import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600'
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PLATFORM-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    logStep("Session ID received", { sessionId });

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    logStep("Stripe session retrieved", { 
      sessionId: session.id, 
      paymentStatus: session.payment_status,
      status: session.status
    });

    // Get user auth header and create service client with propagated JWT for trigger security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseUrl = 'https://ukopxkymzywfpobpcana.supabase.co';
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Robust check: also verify PaymentIntent status in case session.payment_status lags
    const isPaid = session.payment_status === 'paid' ||
      (session.payment_intent ? (await stripe.paymentIntents.retrieve(session.payment_intent as string)).status === 'succeeded' : false);

    if (isPaid) {
      // Try to find existing booking for this session
      let { data: booking, error: getBookingError } = await supabaseService
        .from('bookings')
        .select('id, client_id')
        .eq('stripe_session_id', sessionId)
        .single();

      // Get user now for ownership and for potential booking creation
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseService.auth.getUser(token);
      if (authError || !user) {
        throw new Error('Invalid authentication token');
      }

      if (getBookingError || !booking) {
        // Create booking now using session metadata
        const md: any = session.metadata || {};
        const facilityId = md.facility_id;
        const bookingDate = md.booking_date;
        const startTime = md.start_time;
        const endTime = md.end_time;
        if (!facilityId || !bookingDate || !startTime || !endTime) {
          throw new Error('Missing booking metadata on session');
        }

        // Optional server-side price calculation (triggers also recalc)
        const startDate = new Date(`2000-01-01T${startTime}:00`);
        const endDate = new Date(`2000-01-01T${endTime}:00`);
        const durationMs = endDate.getTime() - startDate.getTime();
        const durationHours = durationMs / (1000 * 60 * 60);
        const pricePerHour = Number(md.price_per_hour || 0);
        const totalPrice = pricePerHour > 0 ? durationHours * pricePerHour : null;

        const insertPayload: any = {
          facility_id: facilityId,
          client_id: user.id,
          booking_date: bookingDate,
          start_time: startTime,
          end_time: endTime,
          status: 'confirmed',
          payment_method: 'card',
          stripe_session_id: sessionId,
          stripe_payment_intent_id: session.payment_intent,
        };
        if (totalPrice !== null) insertPayload.total_price = totalPrice;

        const { data: newBooking, error: createErr } = await supabaseService
          .from('bookings')
          .insert(insertPayload)
          .select('id, client_id')
          .single();

        if (createErr || !newBooking) {
          throw new Error(`Failed to create booking after payment: ${createErr?.message}`);
        }
        booking = newBooking;

        // Also ensure platform_payments exists
        const { data: existingPayment } = await supabaseService
          .from('platform_payments')
          .select('id')
          .eq('stripe_session_id', sessionId)
          .maybeSingle();

        if (!existingPayment) {
          const totalAmount = totalPrice ?? undefined;
          await supabaseService.from('platform_payments').insert({
            booking_id: booking.id,
            facility_owner_id: md.facility_owner_id,
            client_id: user.id,
            stripe_session_id: sessionId,
            total_amount: totalAmount,
            payment_status: 'paid',
            distributed_status: 'pending'
          });
        }
      }

      // Verify ownership
      if (booking.client_id !== user.id) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      logStep("User verified as booking owner");

      // Update booking status (idempotent)
      const { error: bookingError } = await supabaseService
        .from('bookings')
        .update({ 
          status: 'confirmed',
          stripe_payment_intent_id: session.payment_intent
        })
        .eq('stripe_session_id', sessionId);

      if (bookingError) {
        logStep("Booking update failed", bookingError);
      } else {
        logStep("Booking confirmed");
      }

      // Update platform payment status
      const { error: paymentError } = await supabaseService
        .from('platform_payments')
        .update({ 
          payment_status: 'paid'
        })
        .eq('stripe_session_id', sessionId);

      if (paymentError) {
        logStep("Platform payment update failed", paymentError);
      } else {
        logStep("Platform payment marked as paid");
      }

      return new Response(JSON.stringify({ 
        status: 'success',
        message: 'Payment verified and booking confirmed',
        bookingId: booking.id
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Payment failed or not completed - need to verify ownership before cancelling
      
      // Get booking to verify ownership (same as success path)
      const { data: booking, error: getBookingError } = await supabaseService
        .from('bookings')
        .select('client_id')
        .eq('stripe_session_id', sessionId)
        .single();

      if (getBookingError || !booking) {
        throw new Error('Booking not found for session');
      }

      // Get user from auth header for security verification
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('No authorization header provided');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseService.auth.getUser(token);
      
      if (authError || !user) {
        throw new Error('Invalid authentication token');
      }

      // Verify that the authenticated user is the booking owner
      if (booking.client_id !== user.id) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      logStep("User verified as booking owner for cancellation");

      // Payment failed or not completed
      const { error: bookingError } = await supabaseService
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('stripe_session_id', sessionId);

      if (bookingError) {
        logStep("Booking cancellation failed", bookingError);
      } else {
        logStep("Booking cancelled due to payment failure");
      }

      const { error: paymentError } = await supabaseService
        .from('platform_payments')
        .update({ 
          payment_status: 'failed'
        })
        .eq('stripe_session_id', sessionId);

      if (paymentError) {
        logStep("Platform payment status update failed", paymentError);
      }

      return new Response(JSON.stringify({ 
        status: 'failed',
        message: 'Payment was not completed'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});