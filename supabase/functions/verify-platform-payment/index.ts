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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error('Session ID is required');

    logStep("Session ID received", { sessionId });

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Retrieve Checkout Session + (optionally) PaymentIntent
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Stripe session retrieved", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status
    });

    const supabaseUrl = 'https://ukopxkymzywfpobpcana.supabase.co';
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Helper to determine if session is paid
    const isPaid = session.payment_status === 'paid' ||
      (session.payment_intent
        ? (await stripe.paymentIntents.retrieve(session.payment_intent as string)).status === 'succeeded'
        : false);

    // Helper: find client_id reliably without requiring a frontend JWT
    const determineClientId = async (): Promise<string | null> => {
      const md: any = session.metadata || {};
      if (md.client_id) return md.client_id as string;

      // Try from existing booking
      const { data: existingBooking } = await supabaseService
        .from('bookings')
        .select('client_id')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      if (existingBooking?.client_id) return existingBooking.client_id;

      // Try by customer email
      const email = (session.customer_details?.email || session.customer_email) as string | undefined;
      if (email) {
        const { data: profile } = await supabaseService
          .from('profiles')
          .select('user_id')
          .eq('email', email)
          .maybeSingle();
        if (profile?.user_id) return profile.user_id;
      }
      return null;
    };

    // Auto-cancel old pending bookings (>10 min) for this session
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: oldPendingBooking } = await supabaseService
      .from('bookings')
      .select('id, created_at')
      .eq('stripe_session_id', sessionId)
      .eq('status', 'pending')
      .maybeSingle();

    if (oldPendingBooking && oldPendingBooking.created_at && oldPendingBooking.created_at < tenMinutesAgo) {
      logStep('Auto-cancelling old pending booking (>10 min)', { bookingId: oldPendingBooking.id });
      await supabaseService
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', oldPendingBooking.id);
      
      await supabaseService
        .from('platform_payments')
        .update({ payment_status: 'cancelled' })
        .eq('stripe_session_id', sessionId);

      return new Response(
        JSON.stringify({ status: 'timeout', message: 'Payment processing timeout (>10 minutes)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    if (isPaid) {
      // Try to get or create booking
      let { data: booking } = await supabaseService
        .from('bookings')
        .select('id, client_id')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      const md: any = session.metadata || {};

      if (!booking) {
        const clientId = await determineClientId();
        if (!clientId) {
          logStep('Could not determine client_id for booking creation');
        }

        if (!md.facility_id || !md.booking_date || !md.start_time || !md.end_time) {
          logStep('Missing booking metadata on session', md);
        } else if (clientId) {
          // Calculate optional total
          let totalPrice: number | null = null;
          try {
            const startDate = new Date(`2000-01-01T${md.start_time}:00`);
            const endDate = new Date(`2000-01-01T${md.end_time}:00`);
            const hours = (endDate.getTime() - startDate.getTime()) / 3_600_000;
            const pph = Number(md.price_per_hour || 0);
            totalPrice = pph > 0 ? hours * pph : null;
          } catch (_) {
            // ignore
          }

          const insertPayload: any = {
            facility_id: md.facility_id,
            client_id: clientId,
            booking_date: md.booking_date,
            start_time: md.start_time,
            end_time: md.end_time,
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

          if (createErr) {
            logStep('Booking creation failed (paid flow - non-fatal)', { message: createErr.message });
          } else {
            booking = newBooking;
            logStep('Booking created after payment', { bookingId: booking.id });
          }
        }
      }

      // If we still don't have a booking, just mark payments paid and return success (no booking id)
      if (booking?.id) {
        const { error: bookingError } = await supabaseService
          .from('bookings')
          .update({ status: 'confirmed', stripe_payment_intent_id: session.payment_intent })
          .eq('id', booking.id);
        if (bookingError) logStep('Booking confirm update failed', { message: bookingError.message });
      }

      // Upsert platform_payments
      const { data: existingPayment } = await supabaseService
        .from('platform_payments')
        .select('id')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (existingPayment) {
        const { error: payUpdErr } = await supabaseService
          .from('platform_payments')
          .update({ payment_status: 'paid', booking_id: booking?.id ?? null })
          .eq('id', existingPayment.id);
        if (payUpdErr) logStep('Platform payment update failed', { message: payUpdErr.message });
      } else {
        const clientId = await determineClientId();
      const { error: payInsErr } = await supabaseService
        .from('platform_payments')
        .insert({
          booking_id: booking?.id ?? null,
          facility_owner_id: md.facility_owner_id,
          client_id: clientId,
          stripe_session_id: sessionId,
          payment_status: 'paid',
          distributed_status: 'pending',
          total_amount: (session.amount_total || 0) / 100,
          platform_fee_amount: 0.10 * ((session.amount_total || 0) / 100),
          facility_owner_amount: 0.90 * ((session.amount_total || 0) / 100)
        });
        if (payInsErr) logStep('Platform payment insert failed', { message: payInsErr.message });
      }

      // Send booking confirmation emails only once here
      if (booking?.id) {
        try {
          logStep('Sending booking confirmation emails for:', { bookingId: booking.id });
          
          const emailResponse = await fetch('https://ukopxkymzywfpobpcana.supabase.co/functions/v1/send-booking-confirmation', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({ bookingId: booking.id })
          });
          
          if (!emailResponse.ok) {
            logStep('Email sending failed', { status: emailResponse.status });
          } else {
            logStep('Booking confirmation emails sent successfully');
          }
        } catch (emailError) {
          logStep('Failed to send confirmation emails', { error: emailError });
          // Non-fatal error - don't fail the payment verification
        }
      }

      return new Response(
        JSON.stringify({ status: 'success', message: 'Payment verified and booking confirmed', bookingId: booking?.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Not paid -> cancel if booking exists and mark payment failed
    const { data: bookingToCancel } = await supabaseService
      .from('bookings')
      .select('id')
      .eq('stripe_session_id', sessionId)
      .maybeSingle();

    if (bookingToCancel) {
      const { error: cancelErr } = await supabaseService
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingToCancel.id);
      if (cancelErr) logStep('Booking cancellation failed', { message: cancelErr.message });
    }

    const { error: payFailErr } = await supabaseService
      .from('platform_payments')
      .update({ payment_status: 'failed' })
      .eq('stripe_session_id', sessionId);
    if (payFailErr) logStep('Platform payment fail status update failed', { message: payFailErr.message });

    return new Response(
      JSON.stringify({ status: 'failed', message: 'Payment was not completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR', { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
