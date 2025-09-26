import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
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
      .select('id, client_id, facility_id, booking_date, start_time, end_time, status, payment_method, stripe_session_id')
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

    // Send notification emails (both client and owner)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') || '';
      const rawFrom = Deno.env.get('RESEND_FROM_EMAIL') || 'noreply@rezervaarena.com';
      const fromDomain = rawFrom.split('@').pop()?.toLowerCase() || '';
      const disallowedDomains = ['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com','aol.com'];
      const fromEmail = disallowedDomains.includes(fromDomain) ? 'noreply@rezervaarena.com' : rawFrom;

      console.log('Email configuration (cancel):', { hasResendKey: !!resendApiKey, fromEmail });

      if (!resendApiKey) {
        console.warn('RESEND_API_KEY not set. Skipping email notifications.');
      } else {
        const resend = new Resend(resendApiKey);

        // Fetch additional info
        const { data: clientProfile } = await supabase
          .from('profiles')
          .select('email, full_name, phone')
          .eq('user_id', booking.client_id)
          .maybeSingle();

        const { data: ownerProfile } = ownerId ? await supabase
          .from('profiles')
          .select('email, full_name, phone, user_type_comment')
          .eq('user_id', ownerId)
          .maybeSingle() : { data: null as any };

        const { data: facilityData } = await supabase
          .from('facilities')
          .select('name, city, address')
          .eq('id', booking.facility_id)
          .maybeSingle();

        const bookingDate = new Date(booking.booking_date).toLocaleDateString('ro-RO', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
        const startTime = (booking.start_time as string).slice(0,5);
        const endTime = (booking as any).end_time ? (booking as any).end_time.slice(0,5) : undefined;
        const whoForClient = isClient ? 'tine' : (isOwner ? 'proprietar' : 'administrator');
        const whoForOwner = isClient ? 'client' : (isOwner ? 'proprietar' : 'administrator');
        const interval = endTime ? `${startTime} - ${endTime}` : `${startTime}`;

        // Compose emails
        const clientHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
            <div style="background:#fff;padding:24px;border-radius:10px">
              <h2 style="margin:0 0 16px;color:#b91c1c">❗ Rezervare anulată</h2>
              <p>Rezervarea ta a fost anulată de ${whoForClient}.</p>
              <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:8px">
                <p style="margin:4px 0"><strong>Data:</strong> ${bookingDate}</p>
                <p style="margin:4px 0"><strong>Interval:</strong> ${interval}</p>
                <p style="margin:4px 0"><strong>Teren:</strong> ${facilityData?.name ?? 'Teren'}</p>
                <p style="margin:4px 0"><strong>Locație:</strong> ${facilityData?.address ? `${facilityData.address}, ${facilityData.city}` : (facilityData?.city ?? '')}</p>
              </div>
              ${refundProcessed ? `<p style="margin-top:12px">Refund Stripe inițiat (ID: ${refundId}).</p>` : ''}
              <p style="color:#6b7280;font-size:12px;margin-top:16px">Pentru întrebări, contactează: <strong>rezervaarena@gmail.com</strong></p>
            </div>
          </div>
        `;

        const ownerHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9f9f9">
            <div style="background:#fff;padding:24px;border-radius:10px">
              <h2 style="margin:0 0 16px;color:#1f2937">ℹ️ Rezervare anulată</h2>
              <p>O rezervare a fost anulată de ${whoForOwner}.</p>
              <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:8px">
                <p style="margin:4px 0"><strong>Data:</strong> ${bookingDate}</p>
                <p style="margin:4px 0"><strong>Interval:</strong> ${interval}</p>
                <p style="margin:4px 0"><strong>Teren:</strong> ${facilityData?.name ?? 'Teren'}</p>
              </div>
            </div>
          </div>
        `;

        const sends: Promise<any>[] = [];

        if (clientProfile?.email) {
          sends.push(resend.emails.send({
            from: `RezervaArena <${fromEmail}>`,
            to: [clientProfile.email],
            subject: '❗ Anulare Rezervare - RezervaArena',
            html: clientHtml
          }));
        }

        if (ownerProfile?.email) {
          sends.push(resend.emails.send({
            from: `RezervaArena <${fromEmail}>`,
            to: [ownerProfile.email],
            subject: 'ℹ️ Rezervare Anulată - RezervaArena',
            html: ownerHtml
          }));
        }

        const results = await Promise.allSettled(sends);
        console.log('Cancellation email results:', results);
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