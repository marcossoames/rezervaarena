import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingCancellationRequest {
  bookingIds: string[];
  clientEmails: string[];
  facilityName: string;
  reason: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Booking cancellation email function invoked');

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingIds, clientEmails, facilityName, reason }: BookingCancellationRequest = await req.json();
    
    console.log('Processing cancellation emails for:', { 
      bookingCount: bookingIds?.length, 
      clientCount: clientEmails?.length,
      facility: facilityName 
    });

    if (!bookingIds?.length || !clientEmails?.length) {
      console.error('Missing required data for cancellation emails');
      return new Response(
        JSON.stringify({ error: 'Missing booking IDs or client emails' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send cancellation emails to all affected clients
    const emailPromises = clientEmails.map(async (email) => {
      try {
        const emailResponse = await resend.emails.send({
          from: "RezervArena <rezervarena@gmail.com>",
          to: [email],
          subject: `Rezervare anulată - ${facilityName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">RezervArena</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Platforma ta de rezervări sportive</p>
              </div>
              
              <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb;">
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                  <h2 style="color: #dc2626; margin: 0 0 10px 0; font-size: 20px; display: flex; align-items: center;">
                    ⚠️ Rezervare Anulată
                  </h2>
                  <p style="color: #7f1d1d; margin: 0; font-size: 14px;">
                    Din păcate, rezervarea dumneavoastră a fost anulată.
                  </p>
                </div>
                
                <div style="margin-bottom: 25px;">
                  <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px;">Detalii Rezervare:</h3>
                  <div style="background: #f9fafb; border-radius: 8px; padding: 15px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Facilitate:</strong> ${facilityName}</p>
                    <p style="margin: 0 0 8px 0; color: #4b5563;"><strong>Motiv anulare:</strong> ${reason}</p>
                    <p style="margin: 0; color: #6b7280; font-size: 12px;">Data anulării: ${new Date().toLocaleDateString('ro-RO')}</p>
                  </div>
                </div>
                
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                  <h3 style="color: #1e40af; margin: 0 0 10px 0; font-size: 16px;">Ce se întâmplă cu plata?</h3>
                  <p style="color: #1e40af; margin: 0; font-size: 14px; line-height: 1.5;">
                    Dacă ați efectuat o plată pentru această rezervare, suma va fi rambursată în termen de 3-5 zile lucrătoare.
                  </p>
                </div>
                
                <div style="text-align: center;">
                  <a href="https://rezervaarena.com/facilities" 
                     style="background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; margin: 0 10px 10px 0;">
                    Vezi Alte Facilități
                  </a>
                  <a href="https://rezervaarena.com/contact" 
                     style="background: #6b7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    Contactează-ne
                  </a>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; padding: 20px; color: #6b7280; font-size: 12px;">
                <p style="margin: 0;">© 2024 RezervArena. Toate drepturile rezervate.</p>
                <p style="margin: 5px 0 0 0;">
                  Conectăm pasionații de sport cu cele mai bune facilități.
                </p>
              </div>
            </div>
          `,
        });

        console.log(`Cancellation email sent to ${email}:`, emailResponse);
        return { email, success: true, response: emailResponse };
      } catch (emailError) {
        console.error(`Failed to send cancellation email to ${email}:`, emailError);
        return { email, success: false, error: emailError.message };
      }
    });

    const results = await Promise.all(emailPromises);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`Cancellation email results: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cancellation emails processed: ${successCount} sent, ${failureCount} failed`,
        results
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in booking cancellation email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);