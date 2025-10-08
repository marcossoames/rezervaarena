import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CLEANUP-EXPIRED-BOOKINGS] Function started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate timestamp for 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    console.log('[CLEANUP-EXPIRED-BOOKINGS] Looking for pending bookings older than:', tenMinutesAgo);

    // Find all pending bookings older than 10 minutes
    const { data: expiredBookings, error: fetchError } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, created_at, payment_method')
      .eq('status', 'pending')
      .eq('payment_method', 'card')
      .lt('created_at', tenMinutesAgo);

    if (fetchError) {
      console.error('[CLEANUP-EXPIRED-BOOKINGS] Error fetching expired bookings:', fetchError);
      throw fetchError;
    }

    console.log('[CLEANUP-EXPIRED-BOOKINGS] Found expired bookings:', expiredBookings?.length || 0);

    if (!expiredBookings || expiredBookings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired bookings found',
          cleaned: 0
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Cancel all expired pending bookings
    const bookingIds = expiredBookings.map(b => b.id);
    
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('id', bookingIds);

    if (updateError) {
      console.error('[CLEANUP-EXPIRED-BOOKINGS] Error updating bookings:', updateError);
      throw updateError;
    }

    console.log('[CLEANUP-EXPIRED-BOOKINGS] Successfully cancelled', bookingIds.length, 'expired bookings');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Cancelled ${bookingIds.length} expired booking(s)`,
        cleaned: bookingIds.length,
        bookingIds
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[CLEANUP-EXPIRED-BOOKINGS] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
