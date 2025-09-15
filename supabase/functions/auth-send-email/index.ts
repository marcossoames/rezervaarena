import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@rezervaarena.com";
const fromDomain = rawFrom.split("@").pop()?.toLowerCase() || "";
const disallowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com"];
const fromEmail = disallowedDomains.includes(fromDomain) ? "noreply@rezervaarena.com" : rawFrom;

console.log("Auth Email Hook configuration:", {
  hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
  fromEmail: fromEmail
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  user: {
    email: string;
    user_metadata?: any;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to?: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Auth email hook triggered");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhook: AuthEmailRequest = await req.json();
    console.log("Processing auth email for:", webhook.user.email, "Type:", webhook.email_data.email_action_type);

    const { user, email_data } = webhook;
    const { email } = user;
    const { email_action_type, token, token_hash, redirect_to, site_url } = email_data;

    let subject = "";
    let html = "";

    switch (email_action_type) {
      case "signup":
        subject = "Confirmă-ți contul - RezervaArena";
        html = generateSignupEmail(token, token_hash, redirect_to || site_url);
        break;
      
      case "recovery":
        subject = "Resetează-ți parola - RezervaArena";
        html = generatePasswordResetEmail(token, token_hash, redirect_to || site_url);
        break;
      
      case "email_change":
        subject = "Confirmă schimbarea adresei de email - RezervaArena";
        html = generateEmailChangeEmail(token, token_hash, redirect_to || site_url);
        break;
      
      case "magic_link":
        subject = "Link de autentificare - RezervaArena";
        html = generateMagicLinkEmail(token, token_hash, redirect_to || site_url);
        break;
      
      default:
        throw new Error(`Unsupported email action type: ${email_action_type}`);
    }

    const emailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [email],
      subject: subject,
      html: html,
      reply_to: "soamespaul@gmail.com"
    });

    console.log("Auth email sent successfully:", emailResponse);

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Auth email sent successfully",
        emailId: emailResponse.data?.id
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
    console.error("Error in auth-send-email function:", error);
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

function generateSignupEmail(token: string, tokenHash: string, redirectTo: string): string {
  const confirmUrl = `${redirectTo}#access_token=${tokenHash}&type=signup`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color: #22c55e; text-align: center; margin-bottom: 30px;">Bun venit la RezervaArena!</h1>
        
        <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
          <h2 style="color: #15803d; margin-top: 0;">Confirmă-ți contul</h2>
          <p>Pentru a finaliza înregistrarea, te rugăm să confirmi adresa de email făcând clic pe butonul de mai jos:</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="background-color: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Confirmă contul
          </a>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
          <p style="color: #92400e; margin: 0;">
            Dacă nu funcționează butonul, copiază și lipește următorul link în browser:<br>
            <code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 4px;">${confirmUrl}</code>
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            Mulțumim că ai ales RezervaArena!<br>
            Pentru întrebări, contactează suportul la: <strong>soamespaul@gmail.com</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

function generatePasswordResetEmail(token: string, tokenHash: string, redirectTo: string): string {
  const resetUrl = `${redirectTo}/reset-password#access_token=${tokenHash}&type=recovery`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color: #3b82f6; text-align: center; margin-bottom: 30px;">Resetează parola</h1>
        
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
          <h2 style="color: #1e40af; margin-top: 0;">Cerere de resetare parolă</h2>
          <p>Am primit o cerere pentru resetarea parolei contului tău RezervaArena. Fă clic pe butonul de mai jos pentru a seta o parolă nouă:</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Resetează parola
          </a>
        </div>

        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
          <p style="color: #92400e; margin: 0;">
            Dacă nu funcționează butonul, copiază și lipește următorul link în browser:<br>
            <code style="background-color: #f4f4f4; padding: 2px 4px; border-radius: 4px;">${resetUrl}</code>
          </p>
        </div>

        <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin-bottom: 25px;">
          <p style="color: #dc2626; margin: 0;">
            <strong>Observație:</strong> Dacă nu ai solicitat resetarea parolei, poți ignora acest email. Linkul va expira în 1 oră.
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            Pentru întrebări, contactează suportul la: <strong>soamespaul@gmail.com</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

function generateEmailChangeEmail(token: string, tokenHash: string, redirectTo: string): string {
  const confirmUrl = `${redirectTo}#access_token=${tokenHash}&type=email_change`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color: #8b5cf6; text-align: center; margin-bottom: 30px;">Confirmă schimbarea email-ului</h1>
        
        <div style="background-color: #f3e8ff; padding: 20px; border-radius: 8px; border-left: 4px solid #8b5cf6; margin-bottom: 25px;">
          <h2 style="color: #6b21a8; margin-top: 0;">Confirmă noua adresă de email</h2>
          <p>Pentru a finaliza schimbarea adresei de email, te rugăm să confirmi făcând clic pe butonul de mai jos:</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="background-color: #8b5cf6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Confirmă email-ul nou
          </a>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            Pentru întrebări, contactează suportul la: <strong>soamespaul@gmail.com</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

function generateMagicLinkEmail(token: string, tokenHash: string, redirectTo: string): string {
  const loginUrl = `${redirectTo}#access_token=${tokenHash}&type=magiclink`;
  
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h1 style="color: #10b981; text-align: center; margin-bottom: 30px;">Link de autentificare</h1>
        
        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 25px;">
          <h2 style="color: #047857; margin-top: 0;">Accesează contul tău</h2>
          <p>Fă clic pe butonul de mai jos pentru a te autentifica în contul tău RezervaArena:</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" style="background-color: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Autentifică-te
          </a>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <p style="color: #666; font-size: 14px;">
            Pentru întrebări, contactează suportul la: <strong>soamespaul@gmail.com</strong>
          </p>
        </div>
      </div>
    </div>
  `;
}

serve(handler);