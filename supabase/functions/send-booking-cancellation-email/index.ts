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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting booking cancellation email process");
    
    const { bookingIds, clientEmails, facilityName, reason }: BookingCancellationRequest = await req.json();
    
    console.log("Booking cancellation request:", { 
      bookingCount: bookingIds?.length, 
      clientCount: clientEmails?.length,
      facilityName,
      reason 
    });

    if (!bookingIds || !clientEmails || bookingIds.length === 0 || clientEmails.length === 0) {
      throw new Error("Missing required booking or client data");
    }

    const results = [];
    const currentDate = new Date().toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric"
    });

    // Send cancellation email to each affected client
    for (const clientEmail of clientEmails) {
      try {
        console.log(`Sending cancellation email to: ${clientEmail}`);
        
        const emailResult = await resend.emails.send({
          from: "RezervArena <noreply@rezervaarena.com>",
          to: [clientEmail],
          subject: "Rezervare anulată - RezervArena",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Rezervare anulată</title>
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">RezervArena</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Notificare rezervare anulată</p>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
                <h2 style="color: #d73527; margin-top: 0;">Rezervarea ta a fost anulată</h2>
                
                <p>Bună ziua,</p>
                
                <p>Ne pare rău să te informăm că rezervarea ta la <strong>${facilityName}</strong> a fost anulată din următorul motiv:</p>
                
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
                  <strong>Motiv anulare:</strong> ${reason}
                </div>
                
                <p><strong>Data anulării:</strong> ${currentDate}</p>
                
                <p>Dacă ai plătit pentru această rezervare, banii vor fi returnați automat în contul tău în maxim 5-10 zile lucrătoare.</p>
                
                <p>Pentru orice întrebări sau neclarități, te rugăm să ne contactezi:</p>
                <ul>
                  <li>Email: <a href="mailto:contact@rezervaarena.com">contact@rezervaarena.com</a></li>
                  <li>Telefon: <a href="tel:+40720059535">+40720059535</a></li>
                </ul>
                
                <p>Ne cerem scuze pentru inconveniențele create și te invităm să faci o nouă rezervare pe platforma noastră.</p>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef; text-align: center;">
                  <a href="https://rezervaarena.com" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                    Caută alte facilități
                  </a>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
                  Cu respect,<br>
                  <strong>Echipa RezervArena</strong>
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (emailResult.error) {
          console.error(`Failed to send email to ${clientEmail}:`, emailResult.error);
          results.push({ 
            email: clientEmail, 
            success: false, 
            error: emailResult.error.message 
          });
        } else {
          console.log(`Email sent successfully to ${clientEmail}:`, emailResult.data);
          results.push({ 
            email: clientEmail, 
            success: true, 
            id: emailResult.data?.id 
          });
        }
      } catch (emailError: any) {
        console.error(`Error sending email to ${clientEmail}:`, emailError);
        results.push({ 
          email: clientEmail, 
          success: false, 
          error: emailError.message 
        });
      }
    }

    console.log("Cancellation email process completed:", results);

    return new Response(JSON.stringify({ 
      success: true, 
      results,
      message: `Sent ${results.filter(r => r.success).length} of ${results.length} cancellation emails`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-booking-cancellation-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json", 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);