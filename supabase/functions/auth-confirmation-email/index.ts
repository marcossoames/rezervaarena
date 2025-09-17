import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthWebhookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Auth confirmation email function called');
    
    const payload: AuthWebhookPayload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));

    const { user, email_data } = payload;
    const { token_hash, email_action_type, redirect_to, site_url } = email_data;
    
    // Construim URL-ul de confirmare
    const confirmationUrl = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to || site_url)}`;
    
    console.log('Confirmation URL:', confirmationUrl);
    
    // Numele utilizatorului
    const fullName = user.user_metadata?.full_name || user.email.split('@')[0] || 'Utilizator';

    const emailResponse = await resend.emails.send({
      from: "RezervArena <noreply@rezervaarena.lovableproject.com>",
      to: [user.email],
      subject: "Confirmă-ți contul RezervArena",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .logo { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🏟️ RezervArena</div>
              <h1>Bun venit, ${fullName}!</h1>
            </div>
            <div class="content">
              <h2>Confirmă-ți contul</h2>
              <p>Mulțumim că te-ai înregistrat pe RezervArena! Pentru a-ți activa contul și a putea rezerva facilități sportive, te rugăm să confirmi adresa de email.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmationUrl}" class="button">Confirmă contul</a>
              </div>
              
              <p>Dacă butonul de mai sus nu funcționează, copiază și lipește următorul link în browser:</p>
              <p style="background: #e9e9e9; padding: 10px; border-radius: 4px; word-break: break-all; font-size: 14px;">
                ${confirmationUrl}
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
              
              <h3>Ce poți face după confirmare:</h3>
              <ul>
                <li>✅ Rezervă facilități sportive în timpul real</li>
                <li>✅ Gestionează rezervările tale</li>
                <li>✅ Primește confirmări și notificări</li>
                <li>✅ Accesează profilul tău personalizat</li>
              </ul>
            </div>
            <div class="footer">
              <p>Dacă nu ai creat acest cont, poți ignora acest email în siguranță.</p>
              <p><strong>Echipa RezervArena</strong><br>
              Platforma ta pentru rezervarea facilităților sportive</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in auth-confirmation-email function:", error);
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