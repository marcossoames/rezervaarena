import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteAccountRequest {
  userId: string;
  userEmail: string;
  userType: 'client' | 'facility_owner';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting user account deletion process');
    
    const { userId, userEmail, userType }: DeleteAccountRequest = await req.json();
    
    console.log('Processing account deletion for:', {
      userId,
      userEmail,
      userType
    });

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          storage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
          }
        }
      }
    );

    // Execute deletion using the database function
    console.log('Executing account deletion using database function...');

    // 1) Collect active bookings on facilities owned by this user to notify clients
    const { data: ownedFacilities } = await supabaseAdmin
      .from('facilities')
      .select('id, name')
      .eq('owner_id', userId);

    let pendingEmailPayload: {
      booking_ids: string[];
      client_emails: string[];
      facility_names: string[];
      reason: string;
    } | null = null;

    if (ownedFacilities && ownedFacilities.length > 0) {
      const facilityIds = ownedFacilities.map((f: any) => f.id);
      const facilityNames = [...new Set(ownedFacilities.map((f: any) => f.name).filter(Boolean))];

      const { data: activeBookings } = await supabaseAdmin
        .from('bookings')
        .select('id, client_id, status, booking_date')
        .in('facility_id', facilityIds)
        .in('status', ['confirmed','pending']);

      if (activeBookings && activeBookings.length > 0) {
        const bookingIds = activeBookings.map((b: any) => b.id);
        const clientIds = [...new Set(activeBookings.map((b: any) => b.client_id))];

        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('user_id, email')
          .in('user_id', clientIds);

        const clientEmails = (profiles || []).map((p: any) => p.email).filter(Boolean);

        // Store a pending record to ensure email delivery even if subsequent steps fail
        const reason = 'Anulări automate - proprietarul facilității și-a șters contul';
        const { error: insertPendingErr } = await supabaseAdmin
          .from('pending_cancellation_emails')
          .insert({
            booking_ids: bookingIds,
            client_emails: clientEmails,
            facility_names: facilityNames,
            reason,
            processed: false
          });
        if (insertPendingErr) {
          console.warn('Could not insert pending cancellation emails:', insertPendingErr);
        } else {
          pendingEmailPayload = { booking_ids: bookingIds, client_emails: clientEmails, facility_names: facilityNames, reason };
        }
      }
    }
    
    const { data, error: deleteError } = await supabaseAdmin.rpc('delete_user_account_admin', {
      user_id_param: userId
    });

    if (deleteError) {
      console.error('Error executing deletion function:', deleteError);
      throw new Error(`Failed to delete user data: ${deleteError.message}`);
    }

    console.log('User data deletion completed successfully');

    // 2) If we prepared a pending email payload, send the cancellation emails now and mark processed
    try {
      if (pendingEmailPayload) {
        console.log('Sending cancellation emails to affected clients...');
        const emailRes = await supabaseAdmin.functions.invoke('send-booking-cancellation-email', {
          body: {
            bookingIds: pendingEmailPayload.booking_ids,
            clientEmails: pendingEmailPayload.client_emails,
            facilityName: pendingEmailPayload.facility_names.join(', '),
            reason: pendingEmailPayload.reason,
            cancelledBy: 'admin'
          }
        });
        console.log('Cancellation emails response:', emailRes);

        // Best-effort mark all matching pending rows as processed
        await supabaseAdmin
          .from('pending_cancellation_emails')
          .update({ processed: true })
          .contains('booking_ids', pendingEmailPayload.booking_ids.slice(0,1));
      }
    } catch (e) {
      console.warn('Error sending/marking cancellation emails after deletion. Will rely on processor.', e);
    }

    // 6. Finally, delete the user from auth
    console.log('Deleting user from auth...');
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authError) {
      console.error('Error deleting user from auth:', authError);
      throw new Error(`Failed to delete user from auth: ${authError.message}`);
    }

    console.log('User account successfully deleted:', userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account successfully deleted',
        userId 
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error('Error in delete-user-account function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to delete account',
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);