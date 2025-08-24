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
    const { facilityId, date, time, totalPrice, duration } = await req.json();
    
    console.log('Payment request received:', { facilityId, date, time, totalPrice, duration });

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

    // Get facility details
    const { data: facility, error: facilityError } = await supabase
      .from('facilities')
      .select('*')
      .eq('id', facilityId)
      .single();

    if (facilityError || !facility) {
      throw new Error('Facility not found');
    }

    console.log('Processing payment for facility:', facility.name);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Check if customer exists
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log('Existing customer found:', customerId);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Rezervare ${facility.name}`,
              description: `Rezervare pentru ${new Date(date).toLocaleDateString()} la ${time}`,
            },
            unit_amount: Math.round(totalPrice * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/booking/${facilityId}`,
      metadata: {
        facilityId,
        userId: user.id,
        date,
        time,
        duration: duration.toString(),
      },
    });

    console.log('Stripe checkout session created:', session.id);
    console.log('Stripe Request ID:', session.lastResponse?.requestId);

    return new Response(JSON.stringify({ 
      url: session.url,
      session_id: session.id,
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
    console.error('Error creating payment session:', error);
    
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