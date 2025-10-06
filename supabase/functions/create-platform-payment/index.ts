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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

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

    // SECURITY: Validate booking is not in the past
    const today = new Date().toISOString().split('T')[0];
    if (bookingDate < today) {
      throw new Error('Cannot book dates in the past');
    }

    // SECURITY: Check if date/interval is blocked (full-day blocks)
    const { data: fullDayBlocks, error: blockCheckError1 } = await supabaseService
      .from('blocked_dates')
      .select('id')
      .eq('facility_id', facilityId)
      .eq('blocked_date', bookingDate)
      .is('start_time', null)
      .is('end_time', null)
      .limit(1);

    if (blockCheckError1) {
      logStep("Block check failed", blockCheckError1);
      throw new Error('Could not verify availability');
    }

    if (fullDayBlocks && fullDayBlocks.length > 0) {
      throw new Error('Selected interval is blocked (interval blocat)');
    }

    // SECURITY: Check for partial blocked intervals that overlap
    const { data: partialBlocks, error: blockCheckError2 } = await supabaseService
      .from('blocked_dates')
      .select('start_time, end_time')
      .eq('facility_id', facilityId)
      .eq('blocked_date', bookingDate)
      .not('start_time', 'is', null)
      .not('end_time', 'is', null);

    if (blockCheckError2) {
      logStep("Partial block check failed", blockCheckError2);
      throw new Error('Could not verify availability');
    }

    if (partialBlocks && partialBlocks.length > 0) {
      // Check for overlap with any partial block
      for (const block of partialBlocks) {
        const blockStart = block.start_time;
        const blockEnd = block.end_time;
        
        // Check if intervals overlap: (start1 < end2) && (start2 < end1)
        if (startTime < blockEnd && blockStart < endTime) {
          throw new Error('Selected interval overlaps a blocked period (interval blocat)');
        }
      }
    }

    // SECURITY: Check for overlapping existing bookings
    const { data: existingBookings, error: bookingCheckError } = await supabaseService
      .from('bookings')
      .select('start_time, end_time')
      .eq('facility_id', facilityId)
      .eq('booking_date', bookingDate)
      .in('status', ['confirmed', 'pending']);

    if (bookingCheckError) {
      logStep("Booking overlap check failed", bookingCheckError);
      throw new Error('Could not verify availability');
    }

    if (existingBookings && existingBookings.length > 0) {
      // Check for overlap with existing bookings
      for (const booking of existingBookings) {
        const bookingStart = booking.start_time;
        const bookingEnd = booking.end_time;
        
        // Check if intervals overlap
        if (startTime < bookingEnd && bookingStart < endTime) {
          throw new Error('Booking time overlaps with existing booking');
        }
      }
    }

    logStep("All validations passed - proceeding to payment");

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

    // Enforce Stripe minimum charge for RON (2 RON)
    const MIN_AMOUNT_CENTS = 200;
    if (totalAmountCents < MIN_AMOUNT_CENTS) {
      const msg = 'Suma minimă pentru plata cu cardul este 2 RON. Alegeți un interval mai lung sau metoda numerar.';
      logStep('Amount too small', { totalAmountCents });
      return new Response(JSON.stringify({ error: msg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
    const successBase = 'https://rezervaarena.com';
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
