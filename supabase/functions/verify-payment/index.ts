import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ukopxkymzywfpobpcana.supabase.co, http://localhost:3000',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
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

    // Retrieve the checkout session with expanded payment details
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent', 'payment_intent.latest_charge', 'payment_intent.transfer_data']
    });
    
    console.log('Retrieved session:', session.id, 'Payment status:', session.payment_status);
    console.log('Stripe Request ID:', session.lastResponse?.requestId);

    // If payment was successful, create the booking with full payment tracking
    if (session.payment_status === 'paid') {
      const metadata = session.metadata;
      const paymentIntent = session.payment_intent as any;
      const charge = paymentIntent?.latest_charge as any;
      const transfer = paymentIntent?.transfer_data as any;
      
      const bookingData: any = {
        client_id: user.id,
        facility_id: metadata.facilityId,
        booking_date: metadata.date,
        start_time: metadata.time,
        end_time: new Date(new Date(`${metadata.date}T${metadata.time}`).getTime() + parseInt(metadata.duration) * 60000).toTimeString().slice(0, 5),
        status: 'confirmed',
        payment_method: 'card',
        total_amount: session.amount_total / 100, // Convert from cents
        total_price: session.amount_total / 100, // Keep for compatibility
        stripe_session_id: sessionId,
        stripe_payment_intent_id: paymentIntent?.id,
        stripe_charge_id: charge?.id,
        platform_fee_amount: metadata.platformFee ? parseInt(metadata.platformFee) / 100 : null,
        facility_owner_amount: metadata.facilityOwnerAmount ? parseInt(metadata.facilityOwnerAmount) / 100 : null,
        stripe_application_fee_amount: paymentIntent?.application_fee_amount ? paymentIntent.application_fee_amount / 100 : null,
      };

      // If there's a transfer, get the transfer ID
      if (transfer?.destination) {
        // Get the transfer using the charge ID
        const transfers = await stripe.transfers.list({
          destination: transfer.destination,
          limit: 1
        });
        
        if (transfers.data.length > 0) {
          const transferObj = transfers.data.find(t => t.source_transaction === charge?.id);
          if (transferObj) {
            bookingData.stripe_transfer_id = transferObj.id;
            console.log('Found transfer ID:', transferObj.id);
          }
        }
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData);

      if (bookingError) {
        console.error('Error creating booking:', bookingError);
        throw new Error('Failed to create booking');
      }

      // Update facility owner's Stripe Connect status if this was their first payment
      if (transfer?.destination) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            stripe_onboarding_complete: true,
            stripe_charges_enabled: true,
            stripe_payouts_enabled: true
          })
          .eq('stripe_account_id', transfer.destination);

        if (updateError) {
          console.warn('Could not update facility owner Stripe status:', updateError);
        }
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