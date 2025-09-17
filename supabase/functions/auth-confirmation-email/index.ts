import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationEmailRequest {
  email: string;
  confirmationUrl: string;
  fullName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, confirmationUrl, fullName }: ConfirmationEmailRequest = await req.json();

    console.log('Sending confirmation email to:', email);

    const emailResponse = await resend.emails.send({
      from: "RezervArena <onboarding@resend.dev>",
      to: [email],
      subject: "Confirmă-ți contul RezervArena",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmă-ți contul</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin-bottom: 10px;">RezervArena</h1>
            <p style="color: #666; font-size: 16px;">Platforma ta de rezervări sportive</p>
          </div>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1e40af; margin-bottom: 20px;">Bun venit${fullName ? `, ${fullName}` : ''}!</h2>
            
            <p style="margin-bottom: 20px; font-size: 16px;">
              Mulțumim că te-ai înregistrat pe RezervArena! Pentru a-ți activa contul și a începe să rezervi terenuri sportive, 
              te rugăm să confirmi adresa ta de email.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${confirmationUrl}" 
                 style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; font-size: 16px;">
                Confirmă Contul
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              Sau copiază și lipește acest link în browser:
            </p>
            <p style="background-color: #e5e7eb; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 12px;">
              ${confirmationUrl}
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">
              Acest link este valabil pentru 24 de ore.
            </p>
            <p style="color: #666; font-size: 12px;">
              Dacă nu ai creat un cont pe RezervArena, poți ignora acest email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #999; font-size: 12px;">
              © 2024 RezervArena. Toate drepturile rezervate.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, messageId: emailResponse.data?.id }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);