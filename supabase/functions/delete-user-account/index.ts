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

    // Execute deletion using SQL to bypass RLS policies
    console.log('Starting account deletion with SQL commands...');
    
    const deleteAccountSQL = `
      DO $$
      DECLARE
        facility_ids_array UUID[];
      BEGIN
        -- Get facility IDs owned by this user
        SELECT ARRAY(SELECT id FROM public.facilities WHERE owner_id = $1) INTO facility_ids_array;
        
        -- Delete all bookings by this user
        DELETE FROM public.bookings WHERE client_id = $1;
        
        -- Delete all bookings for facilities owned by this user
        IF array_length(facility_ids_array, 1) > 0 THEN
          DELETE FROM public.bookings WHERE facility_id = ANY(facility_ids_array);
        END IF;
        
        -- Delete platform payments
        DELETE FROM public.platform_payments WHERE client_id = $1 OR facility_owner_id = $1;
        
        -- Delete facility-related data if user is facility owner
        IF array_length(facility_ids_array, 1) > 0 THEN
          DELETE FROM public.facility_services WHERE facility_id = ANY(facility_ids_array);
          DELETE FROM public.facility_images WHERE facility_id = ANY(facility_ids_array);
          DELETE FROM public.blocked_dates WHERE facility_id = ANY(facility_ids_array);
          DELETE FROM public.recurring_blocked_dates WHERE facility_id = ANY(facility_ids_array);
          DELETE FROM public.facilities WHERE owner_id = $1;
          DELETE FROM public.sports_complexes WHERE owner_id = $1;
        END IF;
        
        -- Delete bank details
        DELETE FROM public.bank_details WHERE user_id = $1;
        
        -- Delete profile
        DELETE FROM public.profiles WHERE user_id = $1;
        
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Error during account deletion: %', SQLERRM;
      END $$;
    `;

    const { error: sqlError } = await supabaseAdmin.rpc('exec', {
      sql: deleteAccountSQL,
      args: [userId]
    });

    if (sqlError) {
      console.error('Error executing deletion SQL:', sqlError);
      // Fallback to individual deletions if SQL fails
      console.log('Attempting fallback deletion...');
      
      // Try to delete with individual operations
      await supabaseAdmin.from('bookings').delete().eq('client_id', userId);
      await supabaseAdmin.from('platform_payments').delete().or(`client_id.eq.${userId},facility_owner_id.eq.${userId}`);
      await supabaseAdmin.from('bank_details').delete().eq('user_id', userId);
      await supabaseAdmin.from('profiles').delete().eq('user_id', userId);
      
      if (userType === 'facility_owner') {
        await supabaseAdmin.from('facilities').delete().eq('owner_id', userId);
        await supabaseAdmin.from('sports_complexes').delete().eq('owner_id', userId);
      }
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