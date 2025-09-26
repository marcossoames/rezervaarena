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
    );

    // Delete user-related data in the correct order to avoid foreign key conflicts
    
    // 1. Delete bookings (both as client and for owned facilities)
    console.log('Deleting bookings...');
    const { error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('client_id', userId);
    
    if (bookingsError) {
      console.error('Error deleting bookings:', bookingsError);
    }
    
    // Get facility IDs owned by this user
    const { data: facilityIds } = await supabaseAdmin
      .from('facilities')
      .select('id')
      .eq('owner_id', userId);
    
    if (facilityIds && facilityIds.length > 0) {
      const facilityIdList = facilityIds.map(f => f.id);
      
      // Delete bookings for facilities owned by this user
      const { error: facilityBookingsError } = await supabaseAdmin
        .from('bookings')
        .delete()
        .in('facility_id', facilityIdList);
      
      if (facilityBookingsError) {
        console.error('Error deleting facility bookings:', facilityBookingsError);
      }
    }

    // 2. Delete platform payments
    console.log('Deleting platform payments...');
    const { error: paymentsError } = await supabaseAdmin
      .from('platform_payments')
      .delete()
      .or(`client_id.eq.${userId},facility_owner_id.eq.${userId}`);
    
    if (paymentsError) {
      console.error('Error deleting payments:', paymentsError);
    }

    // 3. Delete facility-related data
    if (userType === 'facility_owner' && facilityIds && facilityIds.length > 0) {
      console.log('Deleting facility data...');
      const facilityIdList = facilityIds.map(f => f.id);
      
      // Delete facility services
      const { error: servicesError } = await supabaseAdmin
        .from('facility_services')
        .delete()
        .in('facility_id', facilityIdList);
      
      if (servicesError) {
        console.error('Error deleting facility services:', servicesError);
      }

      // Delete facility images
      const { error: imagesError } = await supabaseAdmin
        .from('facility_images')
        .delete()
        .in('facility_id', facilityIdList);
      
      if (imagesError) {
        console.error('Error deleting facility images:', imagesError);
      }

      // Delete blocked dates
      const { error: blockedDatesError } = await supabaseAdmin
        .from('blocked_dates')
        .delete()
        .in('facility_id', facilityIdList);
      
      if (blockedDatesError) {
        console.error('Error deleting blocked dates:', blockedDatesError);
      }

      // Delete recurring blocked dates
      const { error: recurringBlockedError } = await supabaseAdmin
        .from('recurring_blocked_dates')
        .delete()
        .in('facility_id', facilityIdList);
      
      if (recurringBlockedError) {
        console.error('Error deleting recurring blocked dates:', recurringBlockedError);
      }

      // Delete facilities
      const { error: facilitiesError } = await supabaseAdmin
        .from('facilities')
        .delete()
        .eq('owner_id', userId);
      
      if (facilitiesError) {
        console.error('Error deleting facilities:', facilitiesError);
      }

      // Delete sports complexes
      const { error: complexError } = await supabaseAdmin
        .from('sports_complexes')
        .delete()
        .eq('owner_id', userId);
      
      if (complexError) {
        console.error('Error deleting sports complex:', complexError);
      }
    }

    // 4. Delete bank details
    console.log('Deleting bank details...');
    const { error: bankError } = await supabaseAdmin
      .from('bank_details')
      .delete()
      .eq('user_id', userId);
    
    if (bankError) {
      console.error('Error deleting bank details:', bankError);
    }

    // 5. Delete profile
    console.log('Deleting profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userId);
    
    if (profileError) {
      console.error('Error deleting profile:', profileError);
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