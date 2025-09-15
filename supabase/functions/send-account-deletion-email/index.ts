import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@rezervaarena.com";
const fromDomain = rawFrom.split("@").pop()?.toLowerCase() || "";
const disallowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com"];
const fromEmail = disallowedDomains.includes(fromDomain) ? "noreply@rezervaarena.com" : rawFrom;

console.log("Email configuration:", {
  hasResendKey: !!Deno.env.get("RESEND_API_KEY"),
  fromEmail: fromEmail,
  testMode: false
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountDeletionRequest {
  userId: string;
  userEmail: string;
  userName: string;
  userType: "client" | "facility_owner";
  cancelledBookings?: number;
  deactivatedFacilities?: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Starting account deletion email process");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, userName, userType, cancelledBookings, deactivatedFacilities }: AccountDeletionRequest = await req.json();
    console.log("Processing account deletion for:", { userId, userEmail, userType });

    if (!userId || !userEmail || !userName) {
      throw new Error("User ID, email, and name are required");
    }

    // Format current date
    const deletionDate = new Date().toLocaleDateString("ro-RO", {
      weekday: "long",
      year: "numeric",
      month: "long", 
      day: "numeric"
    });

    const deletionTime = new Date().toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit"
    });

    // Email content varies by user type
    let subject = "";
    let emailContent = "";

    if (userType === "client") {
      subject = "🗑️ Confirmare Ștergere Cont - RezervaArena";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #dc2626; text-align: center; margin-bottom: 30px;">Cont Șters cu Succes</h1>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin-top: 0;">Confirmare Ștergere</h2>
              <p><strong>Numele Contului:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Data Ștergerii:</strong> ${deletionDate}</p>
              <p><strong>Ora Ștergerii:</strong> ${deletionTime}</p>
              ${cancelledBookings ? `<p><strong>Rezervări Anulate:</strong> ${cancelledBookings} rezervări viitoare</p>` : ''}
            </div>

            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin-top: 0;">📋 Ce s-a întâmplat</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Contul dvs. a fost șters definitiv din sistemul RezervaArena</li>
                ${cancelledBookings ? `<li>Au fost anulate automat ${cancelledBookings} rezervări viitoare</li>` : ''}
                <li>Toate datele personale au fost eliminate</li>
                <li>Nu veți mai primi notificări pe această adresă de email</li>
              </ul>
            </div>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">💙 Vă mulțumim!</h3>
              <p style="color: #1e40af; margin: 0;">
                Vă mulțumim că ați folosit RezervaArena! Dacă doriți să vă întoarceți în viitor, 
                veți putea crea un cont nou oricând. Sperăm să ne revedem!
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Pentru întrebări sau suport, contactați-ne la: <strong>soamespaul@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      subject = "🗑️ Confirmare Ștergere Cont Proprietar - RezervaArena";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #dc2626; text-align: center; margin-bottom: 30px;">Cont Proprietar Șters cu Succes</h1>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin-top: 0;">Confirmare Ștergere</h2>
              <p><strong>Numele Proprietarului:</strong> ${userName}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
              <p><strong>Data Ștergerii:</strong> ${deletionDate}</p>
              <p><strong>Ora Ștergerii:</strong> ${deletionTime}</p>
              ${cancelledBookings ? `<p><strong>Rezervări Anulate:</strong> ${cancelledBookings} rezervări viitoare</p>` : ''}
              ${deactivatedFacilities ? `<p><strong>Facilități Dezactivate:</strong> ${deactivatedFacilities} facilități</p>` : ''}
            </div>

            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin-top: 0;">📋 Ce s-a întâmplat</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Contul dvs. de proprietar a fost șters definitiv</li>
                ${deactivatedFacilities ? `<li>Au fost dezactivate ${deactivatedFacilities} facilități sportive</li>` : ''}
                ${cancelledBookings ? `<li>Au fost anulate automat ${cancelledBookings} rezervări viitoare pe facilitățile dvs.</li>` : ''}
                <li>Toate datele personale și de business au fost eliminate</li>
                <li>Facilitățile rămân în istoric pentru rezervările anterioare</li>
              </ul>
            </div>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">💙 Vă mulțumim pentru parteneriat!</h3>
              <p style="color: #1e40af; margin: 0;">
                Vă mulțumim că ați fost parte din RezervaArena! Dacă doriți să vă întoarceți 
                ca proprietar în viitor, veți putea crea un cont nou și adăuga din nou facilitățile. 
                Sperăm să ne revedem!
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Pentru întrebări sau suport, contactați-ne la: <strong>soamespaul@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    }

    // Send deletion confirmation email
    const emailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [userEmail],
      subject: subject,
      html: emailContent,
    });

    console.log("Account deletion email sent:", emailResponse);

    if (emailResponse.error) {
      console.error("Email error:", emailResponse.error);
      throw new Error("Failed to send account deletion email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Account deletion email sent successfully",
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
    console.error("Error in send-account-deletion-email function:", error);
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