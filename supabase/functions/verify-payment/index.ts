import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    console.log('Verifying payment for session:', sessionId);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    console.log('Retrieved session:', session.id, 'Payment status:', session.payment_status);
    console.log('Stripe Request ID:', session.lastResponse?.requestId);

    // If payment was successful, create the booking
    if (session.payment_status === 'paid') {
      const metadata = session.metadata;
      
      const { error: bookingError } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          facility_id: metadata.facilityId,
          booking_date: metadata.date,
          start_time: metadata.time,
          end_time: new Date(new Date(`${metadata.date}T${metadata.time}`).getTime() + parseInt(metadata.duration) * 60000).toTimeString().slice(0, 5),
          status: 'confirmed',
          payment_method: 'card',
          total_amount: session.amount_total / 100, // Convert from cents
          stripe_session_id: sessionId,
        });

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        throw new Error('Failed to create booking');
      }

      console.log('Booking created successfully for user:', user.email);
    }

    return new Response(JSON.stringify({
      payment_status: session.payment_status,
      customer_email: session.customer_email || session.customer_details?.email,
      amount_total: session.amount_total,
      request_id: session.lastResponse?.requestId
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Stripe-Request-Id": session.lastResponse?.requestId || ""
      },
      status: 200,
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    
    // Log Stripe request ID if available for debugging
    if (error.requestId) {
      console.error('Stripe Request ID for failed request:', error.requestId);
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      request_id: error.requestId || null
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Stripe-Request-Id": error.requestId || ""
      },
      status: 500,
    });
  }
});