import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    if (!hookSecret) {
      throw new Error("Missing SEND_EMAIL_HOOK_SECRET");
    }

    // Supabase sends SIGNED WEBHOOKS. We must verify using the secret and parse raw text.
    const payloadText = await req.text();
    const headers = Object.fromEntries(req.headers);
    const wh = new Webhook(hookSecret);

    const {
      user,
      email_data: { token_hash, redirect_to, email_action_type, site_url },
    } = wh.verify(payloadText, headers) as {
      user: { id: string; email: string; user_metadata?: { full_name?: string } };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new?: string;
        token_hash_new?: string;
      };
    };

    const fullName = user.user_metadata?.full_name || user.email.split("@")[0] || "Utilizator";

    // Build the standard Supabase verification link with proper redirect
    // Always call Supabase's verify endpoint on the project domain
    const SUPABASE_URL = "https://ukopxkymzywfpobpcana.supabase.co";

    // Build redirect origin: prefer configured Site URL from GoTrue webhook
    const siteOrigin = site_url?.replace(/\/$/, "");
    const baseOrigin = siteOrigin || (redirect_to?.includes('localhost') ? 'http://localhost:3000' : 'https://rezervaarena.com');
    
    const finalRedirect = `${baseOrigin}/email-confirmation`;
    const confirmationUrl = `${SUPABASE_URL}/auth/v1/verify?token_hash=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(finalRedirect)}`;

    console.log("Sending confirmation email via Resend to:", user.email);
    console.log("Final redirect URL:", finalRedirect);
    console.log("Confirmation URL:", confirmationUrl);

    const { error: resendError } = await resend.emails.send({
      from: "RezervaArena <onboarding@resend.dev>",
      to: [user.email],
      subject: "Confirmă-ți contul RezervaArena",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Confirmă-ți contul</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; margin: 0; padding: 0; }
              .wrap { max-width: 640px; margin: 0 auto; padding: 24px; }
              .card { background: #f9fafb; border-radius: 12px; padding: 28px; }
              .btn { display:inline-block; background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:700; }
              .muted { color: #6b7280; font-size: 14px; }
              .small { font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="wrap">
              <h1>RezervaArena</h1>
              <div class="card">
                <h2 style="margin-top:0">Bun venit${fullName ? ", " + fullName : ""}!</h2>
                <p>Te rugăm să îți confirmi adresa de email pentru a activa contul.</p>
                <p style="text-align:center; margin: 28px 0;">
                  <a class="btn" href="${confirmationUrl}">Confirmă contul</a>
                </p>
                <p class="muted">Dacă butonul nu funcționează, copiază acest link:</p>
                <p class="small" style="word-break: break-all;">${confirmationUrl}</p>
              </div>
              <p class="small" style="margin-top:16px;">Dacă nu ai creat acest cont, poți ignora acest email.</p>
            </div>
          </body>
        </html>
      `,
    });

    if (resendError) {
      console.error("Resend error:", resendError);
      throw new Error(String(resendError));
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("auth-confirmation-email error:", error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});