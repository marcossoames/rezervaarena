import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@rezervaarena.com";
const fromDomain = rawFrom.split("@").pop()?.toLowerCase() || "";
const disallowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com"];
const fromEmail = disallowedDomains.includes(fromDomain) ? "noreply@rezervaarena.com" : rawFrom;

const SUPABASE_URL = "https://ukopxkymzywfpobpcana.supabase.co";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: { email: string; redirectUrl?: string } = await req.json();
    console.log("auth-recovery-email: request", { email, hasRedirect: !!redirectUrl });

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ success: false, error: "Email invalid" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    if (!SERVICE_KEY) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
    }

    // Build a safe redirect base (avoid localhost in production)
    const reqOrigin = req.headers.get("origin") || "";
    const safeBase =
      (redirectUrl && !redirectUrl.includes("localhost") && redirectUrl) ||
      (reqOrigin && !reqOrigin.includes("localhost") && reqOrigin) ||
      "https://rezervaarena.com";

    const redirect = `${safeBase}/reset-password`;
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirect },
    });

    if (error) {
      console.error("auth-recovery-email: generateLink error", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const actionLink = (data as any)?.properties?.action_link || (data as any)?.action_link;
    if (!actionLink) {
      console.error("auth-recovery-email: no action_link in response", data);
      return new Response(JSON.stringify({ success: false, error: "Nu s-a putut genera link-ul de resetare." }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const emailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [email],
      subject: "Resetează-ți parola - RezervaArena",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #3b82f6; text-align: center; margin-bottom: 30px;">Resetează parola</h1>
            <p>Am primit o cerere pentru resetarea parolei contului tău RezervaArena. Apasă butonul de mai jos pentru a seta o parolă nouă:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Resetează parola</a>
            </div>
            <p style="font-size: 14px; color: #555;">Dacă butonul nu funcționează, copiază acest link în browser:<br /><span style="word-break: break-all;">${actionLink}</span></p>
            <p style="color: #666; font-size: 14px; text-align: center; margin-top: 24px;">Pentru întrebări, contactează suportul la: <strong>soamespaul@gmail.com</strong></p>
          </div>
        </div>
      `,
      reply_to: "soamespaul@gmail.com",
    });

    console.log("auth-recovery-email: sent", emailResponse);
    if (emailResponse.error) {
      throw emailResponse.error;
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (e: any) {
    console.error("auth-recovery-email: error", e);
    return new Response(JSON.stringify({ success: false, error: e.message || "Eroare neașteptată" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});