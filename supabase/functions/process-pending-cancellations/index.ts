import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting pending cancellation emails processing");

    // Initialize Supabase client
    const supabaseUrl = "https://ukopxkymzywfpobpcana.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseServiceKey) {
      throw new Error("Supabase service key not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all unprocessed cancellation emails
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('pending_cancellation_emails')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError);
      throw fetchError;
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('No pending cancellation emails to process');
      return new Response(
        JSON.stringify({ success: true, message: "No pending emails found", processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${pendingEmails.length} pending cancellation emails to process`);

    let processedCount = 0;
    let failedCount = 0;

    // Process each pending email
    for (const emailData of pendingEmails) {
      try {
        console.log(`Processing cancellation email ID: ${emailData.id}`);

        // Call the send-booking-cancellation-email function
        const emailResponse = await fetch('https://ukopxkymzywfpobpcana.supabase.co/functions/v1/send-booking-cancellation-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            bookingIds: emailData.booking_ids,
            clientEmails: emailData.client_emails,
            facilityName: emailData.facility_names?.join(', '),
            reason: emailData.reason
          })
        });

        if (emailResponse.ok) {
          // Mark as processed
          const { error: updateError } = await supabase
            .from('pending_cancellation_emails')
            .update({ processed: true })
            .eq('id', emailData.id);

          if (updateError) {
            console.error(`Error marking email as processed (ID: ${emailData.id}):`, updateError);
          } else {
            processedCount++;
            console.log(`Successfully processed cancellation email ID: ${emailData.id}`);
          }
        } else {
          const errorText = await emailResponse.text();
          console.error(`Failed to send cancellation email (ID: ${emailData.id}):`, errorText);
          failedCount++;
        }
      } catch (emailError) {
        console.error(`Error processing cancellation email (ID: ${emailData.id}):`, emailError);
        failedCount++;
      }
    }

    console.log(`Cancellation email processing completed: ${processedCount} processed, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} cancellation emails, ${failedCount} failed`,
        processed: processedCount,
        failed: failedCount
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );

  } catch (error: any) {
    console.error("Error in process-pending-cancellations function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);