import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_BASE_URL') || 'https://sportspot-booker.lovable.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PLATFORM-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { facilityId, bookingDate, startTime, endTime } = await req.json();
    
    if (!facilityId || !bookingDate || !startTime || !endTime) {
      throw new Error('Missing required booking information');
    }

    logStep("Booking details received", { facilityId, bookingDate, startTime, endTime });

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    // Get facility details and owner
    const { data: facility, error: facilityError } = await supabase
      .from('facilities')
      .select('name, price_per_hour, owner_id, is_active')
      .eq('id', facilityId)
      .single();

    if (facilityError || !facility) {
      throw new Error('Facility not found');
    }

    if (!facility.is_active) {
      throw new Error('Facility is not active');
    }

    // Calculate total price SERVER-SIDE (never trust client)
    const startDate = new Date(`2000-01-01T${startTime}:00`);
    const endDate = new Date(`2000-01-01T${endTime}:00`);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const totalPrice = durationHours * facility.price_per_hour;

    logStep("Facility found and price calculated", { 
      facilityName: facility.name, 
      ownerId: facility.owner_id,
      pricePerHour: facility.price_per_hour,
      durationHours,
      calculatedTotalPrice: totalPrice
    });

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
    });

    logStep("Stripe initialized");

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create during checkout");
    }

    // Calculate fees - Stripe fee is 1.5% + 1 RON
    const totalAmountCents = Math.round(totalPrice * 100);
    const stripeFeePercentage = 0.015; // 1.5%
    const stripeFixedFeeCents = 100; // 1 RON in cents
    const stripeTotalFeeCents = Math.round(totalAmountCents * stripeFeePercentage) + stripeFixedFeeCents;
    const facilityOwnerAmountCents = totalAmountCents - stripeTotalFeeCents;

    logStep("Fee calculation", {
      totalAmountCents,
      stripeTotalFeeCents,
      facilityOwnerAmountCents,
      stripeFeePercentage,
      stripeFixedFeeCents
    });

    // Create Stripe checkout session - all money goes to platform
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: 'ron',
            product_data: { 
              name: `Rezervare ${facility.name}`,
              description: `Data: ${bookingDate}, Ora: ${startTime} - ${endTime}`
            },
            unit_amount: totalAmountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('APP_BASE_URL') || 'https://sportspot-booker.lovable.app'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get('APP_BASE_URL') || 'https://sportspot-booker.lovable.app'}/facilities`,
      metadata: {
        facility_id: facilityId,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        facility_owner_id: facility.owner_id,
        client_id: user.id
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          facility_id: facilityId
        }
      }
    });

    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    // Create the booking first
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { data: booking, error: bookingError } = await supabaseService
      .from('bookings')
      .insert({
        facility_id: facilityId,
        client_id: user.id,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        total_price: totalPrice,
        status: 'pending',
        payment_method: 'card',
        stripe_session_id: session.id
      })
      .select()
      .single();

    if (bookingError) {
      logStep("Booking creation failed", bookingError);
      throw new Error(`Failed to create booking: ${bookingError.message}`);
    }

    logStep("Booking created", { bookingId: booking.id });

    // Record the platform payment tracking
    const { error: paymentError } = await supabaseService
      .from('platform_payments')
      .insert({
        booking_id: booking.id,
        facility_owner_id: facility.owner_id,
        client_id: user.id,
        stripe_session_id: session.id,
        total_amount: totalPrice,
        platform_fee_amount: stripeTotalFeeCents / 100,
        facility_owner_amount: facilityOwnerAmountCents / 100,
        payment_status: 'pending',
        distributed_status: 'pending'
      });

    if (paymentError) {
      logStep("Platform payment tracking failed", paymentError);
      // Don't fail the whole process, just log the error
      console.error('Failed to create platform payment record:', paymentError);
    } else {
      logStep("Platform payment tracking created");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

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