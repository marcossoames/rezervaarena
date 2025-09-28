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
    
    const { data, error: deleteError } = await supabaseAdmin.rpc('delete_user_account_admin', {
      user_id_param: userId
    });

    if (deleteError) {
      console.error('Error executing deletion function:', deleteError);
      throw new Error(`Failed to delete user data: ${deleteError.message}`);
    }

    console.log('User data deletion completed successfully');

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