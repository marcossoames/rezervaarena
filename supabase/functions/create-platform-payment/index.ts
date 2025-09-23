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
  console.log(`[CREATE-PLATFORM-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sessionUrl: string | undefined;

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

    const supabaseUrl = 'https://ukopxkymzywfpobpcana.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3B4a3ltenl3ZnBvYnBjYW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MTI4MzAsImV4cCI6MjA3MTM4ODgzMH0.GL1gd0IkKn-_r9wVG4omebQb8Pivq0_FjNDlR6LcLIc';

    // Authenticated client (impersonates end-user)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    // Service client with propagated JWT so triggers see auth.uid()
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Fetch facility details (SECURITY DEFINER function)
    const { data: facilityData, error: facilityError } = await supabase
      .rpc('get_facility_for_payment_processing', { facility_id_param: facilityId });

    if (facilityError || !facilityData || facilityData.length === 0) {
      logStep("Facility fetch error", facilityError);
      throw new Error(`Facility not found: ${facilityError?.message || 'Unknown error'}`);
    }

    const facility = facilityData[0];

    // Calculate total price server-side
    const startDate = new Date(`2000-01-01T${startTime}:00`);
    const endDate = new Date(`2000-01-01T${endTime}:00`);
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const totalPrice = durationHours * Number(facility.price_per_hour);

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

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    logStep("Stripe initialized");

    // Optionally find existing customer
    let customerId: string | undefined;
    try {
      const customers = await stripe.customers.list({ email: user.email ?? undefined, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        logStep("Existing customer found", { customerId });
      } else {
        logStep("No existing customer, will create during checkout");
      }
    } catch (e) {
      logStep("Customer lookup failed (non-fatal)");
    }

    // Stripe fees for logging (not used by Checkout directly)
    const totalAmountCents = Math.round(totalPrice * 100);
    const stripeFeePercentage = 0.015;
    const stripeFixedFeeCents = 100;
    const stripeTotalFeeCents = Math.round(totalAmountCents * stripeFeePercentage) + stripeFixedFeeCents;
    const facilityOwnerAmountCents = Math.max(totalAmountCents - stripeTotalFeeCents, 0);

    logStep("Fee calculation", {
      totalAmountCents,
      stripeTotalFeeCents,
      facilityOwnerAmountCents,
      stripeFeePercentage,
      stripeFixedFeeCents
    });

    // Create Stripe Checkout session
    const successBase = 'https://947ae49f-e8d5-4283-95f7-ef683f84f2b9.lovableproject.com';
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email ?? undefined,
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
      success_url: `${successBase}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successBase}/facilities`,
      metadata: {
        facility_id: facilityId,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        facility_owner_id: facility.owner_id,
        client_id: user.id,
        price_per_hour: String(facility.price_per_hour)
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          facility_id: facilityId
        }
      }
    });

    sessionUrl = session.url ?? undefined;
    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    // Try to insert booking (non-fatal)
    try {
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
        logStep("Booking creation failed (non-fatal)", bookingError);
      } else {
        logStep("Booking created", { bookingId: booking.id });
      }
    } catch (e) {
      logStep("Booking insert threw (non-fatal)", { message: (e as Error).message });
    }

    // Try to insert platform payment record (non-fatal)
    try {
      const { error: paymentError } = await supabaseService
        .from('platform_payments')
        .insert({
          booking_id: null, // may be null at this moment
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
        logStep("Platform payment tracking failed (non-fatal)", paymentError);
      } else {
        logStep("Platform payment tracking created");
      }
    } catch (e) {
      logStep("Platform payment insert threw (non-fatal)", { message: (e as Error).message });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // If we already created a session, still return 200 so the UI can redirect
    if (sessionUrl) {
      return new Response(JSON.stringify({ url: sessionUrl, warning: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
