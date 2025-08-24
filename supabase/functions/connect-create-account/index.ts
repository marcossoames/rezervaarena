import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://ukopxkymzywfpobpcana.supabase.co, http://localhost:3000',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, country = 'RO', business_type = 'individual' } = await req.json();
    
    if (!email) {
      throw new Error('Email is required');
    }

    console.log('Creating Stripe Connect account for:', email);

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Create Stripe Express account
    const account = await stripe.accounts.create({
      type: 'express',
      country: country,
      email: email,
      business_type: business_type,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    console.log('Created Stripe account:', account.id);

    // Update user profile with Stripe account ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false,
        stripe_charges_enabled: false,
        stripe_payouts_enabled: false,
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      throw new Error('Failed to update profile');
    }

    console.log('Profile updated with Stripe account ID for user:', user.email);

    return new Response(JSON.stringify({
      account_id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error creating Stripe Connect account:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});