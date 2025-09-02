import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ALLOWED_ORIGINS') || 'https://sportspot-booker.lovable.app',
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

    // Use service role to update booking and payment records
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    if (session.payment_status === 'paid') {
      // Get booking to verify ownership
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

      logStep("User verified as booking owner");

      // Update booking status
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
        message: 'Payment verified and booking confirmed'
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