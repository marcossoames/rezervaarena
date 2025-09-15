import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '3600'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting booking cancellation process...');
    
    const requestBody = await req.json();
    const { bookingId } = requestBody;
    
    console.log('Cancellation request received for booking:', bookingId);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    console.log('Attempting to authenticate user...');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    console.log('User authentication result:', { user: !!user, error: !!userError });
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      throw new Error('User not authenticated');
    }

const supabaseUser = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
);

const { data: selfProfile } = await supabaseUser
  .from('profiles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();

const isAdmin = selfProfile?.role === 'admin';
console.log('Fetching booking details for user:', user.id);

    // Get booking details (do not constrain by client here)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, client_id, facility_id, booking_date, start_time, status, payment_method, stripe_session_id')
      .eq('id', bookingId)
      .maybeSingle();

    console.log('Booking query result:', { booking: !!booking, error: !!bookingError });

    if (bookingError) {
      console.error('Booking query error:', bookingError);
      throw new Error('Booking not found or access denied');
    }
    if (!booking) {
      console.error('No booking found with ID:', bookingId);
      throw new Error('Booking not found or access denied');
    }

    // Determine permissions: client or facility owner can cancel
    const isClient = booking.client_id === user.id;

    const { data: facilityOwner } = await supabase
      .from('facilities')
      .select('owner_id')
      .eq('id', booking.facility_id)
      .maybeSingle();

    const ownerId = facilityOwner?.owner_id as string | undefined;
    const isOwner = ownerId === user.id;
    console.log('Permission check:', { isClient, isOwner, isAdmin });

    if (!isClient && !isOwner && !isAdmin) {
      throw new Error('Access denied');
    }

    // Enforce 24h rule only for client-initiated cancellations
    if (!isOwner && !isAdmin) {
      const bookingDateTime = new Date(`${booking.booking_date}T${booking.start_time}`);
      const now = new Date();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      const timeDifference = bookingDateTime.getTime() - now.getTime();

      if (timeDifference < oneDayInMs) {
        throw new Error('Rezervarea poate fi anulată doar cu cel puțin 24 de ore înainte');
      }
    }

    // Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      throw new Error('Rezervarea este deja anulată');
    }

    console.log('Processing cancellation for booking:', booking);

    let refundProcessed = false;
    let refundId = null;

    // Process refund if payment was made by card (has stripe_session_id)
    if (booking.stripe_session_id && booking.payment_method === 'card') {
      console.log('Processing Stripe refund for session:', booking.stripe_session_id);
      
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16',
      });

      try {
        // Get the checkout session to find the payment intent
        const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
        
        if (session.payment_intent) {
          // Create refund
          const refund = await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: 'requested_by_customer',
          });

          refundProcessed = true;
          refundId = refund.id;
          console.log('Refund processed successfully:', refund.id);
        }
      } catch (stripeError) {
        console.error('Stripe refund error:', stripeError);
        // Continue with cancellation even if refund fails
      }
    }

    // Update booking status to cancelled
    const { error: updateError } = await supabaseUser
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        notes: isOwner || isAdmin
          ? 'Anulat de ' + (isOwner ? 'proprietar' : 'administrator')
          : refundProcessed 
            ? `Anulat de client. Refund processat: ${refundId}` 
            : booking.payment_method === 'cash' 
              ? 'Anulat de client. Plata cash - fără refund' 
              : 'Anulat de client'
      })
      .eq('id', bookingId);

    if (updateError) {
      console.error('Update error:', updateError);
      throw new Error('Failed to update booking status');
    }

    console.log('Booking cancelled successfully');

    // Send notification email
    try {
      const resend = new Resend(Deno.env.get('RESEND_API_KEY') || '');
      let toEmail: string | null = null;
      let subject = '';
      let html = '';

      if (isClient && ownerId) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', ownerId)
          .maybeSingle();
        toEmail = ownerProfile?.email ?? null;
        subject = 'Rezervare anulată de client';
        html = `<p>Bună,</p><p>Clientul a anulat o rezervare pentru data ${booking.booking_date} la ${booking.start_time}.</p>`;
      } else {
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', booking.client_id)
          .maybeSingle();
        toEmail = clientProfile?.email ?? null;
        subject = 'Rezervarea ta a fost anulată';
        html = `<p>Bună,</p><p>Rezervarea ta din ${booking.booking_date} la ${booking.start_time} a fost anulată de ${isOwner ? 'proprietar' : 'administrator'}.</p>`;
      }

      if (toEmail) {
        await resend.emails.send({
          from: 'RezervaArena <no-reply@rezervaarena.ro>',
          to: [toEmail],
          subject,
          html,
        });
      } else {
        console.log('Email target not found, skip send.');
      }
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      refundProcessed,
      refundId,
      message: refundProcessed 
        ? 'Rezervarea a fost anulată cu succes. Banii vor fi returnați în 3-5 zile lucrătoare.' 
        : booking.payment_method === 'cash'
          ? 'Rezervarea a fost anulată cu succes.'
          : 'Rezervarea a fost anulată cu succes.'
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json"
      },
      status: 200,
    });

  } catch (error) {
    console.error('Error cancelling booking:', error);
    
    // Return 200 with structured error for better UX in clients
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json"
      },
      status: 200,
    });
  }
});