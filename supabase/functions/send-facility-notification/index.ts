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

interface FacilityNotificationRequest {
  facilityId: string;
  action: "created" | "deleted";
  ownerEmail: string;
  ownerName: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Starting facility notification email process");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { facilityId, action, ownerEmail, ownerName }: FacilityNotificationRequest = await req.json();
    console.log("Processing facility notification:", { facilityId, action, ownerEmail });

    if (!facilityId || !action || !ownerEmail || !ownerName) {
      throw new Error("All fields are required");
    }

    // Initialize Supabase client
    const supabaseUrl = "https://ukopxkymzywfpobpcana.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseServiceKey) {
      throw new Error("Supabase service key not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get facility details
    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("*")
      .eq("id", facilityId)
      .single();

    if (facilityError && action === "created") {
      console.error("Error fetching facility:", facilityError);
      throw new Error("Facility not found");
    }

    // Format current date
    const actionDate = new Date().toLocaleDateString("ro-RO", {
      weekday: "long",
      year: "numeric",
      month: "long", 
      day: "numeric"
    });

    const actionTime = new Date().toLocaleTimeString("ro-RO", {
      hour: "2-digit",
      minute: "2-digit"
    });

    let subject = "";
    let emailContent = "";

    if (action === "created") {
      subject = "✅ Facilitare Sportivă Adăugată cu Succes - RezervaArena";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #22c55e; text-align: center; margin-bottom: 30px;">🎉 Facilitatea Sportivă a fost Adăugată!</h1>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
              <h2 style="color: #15803d; margin-top: 0;">Detalii Facilitate</h2>
              <p><strong>Nume Facilitate:</strong> ${facility.name}</p>
              <p><strong>Tip:</strong> ${facility.facility_type}</p>
              <p><strong>Oraș:</strong> ${facility.city}</p>
              <p><strong>Adresa:</strong> ${facility.address}</p>
              <p><strong>Preț/Oră:</strong> ${facility.price_per_hour} RON</p>
              <p><strong>Capacitate:</strong> ${facility.capacity} persoane</p>
              <p><strong>Data Adăugării:</strong> ${actionDate} la ${actionTime}</p>
            </div>

            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">🚀 Ce urmează?</h3>
              <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
                <li>Facilitatea dvs. este acum activă pe RezervaArena</li>
                <li>Clienții pot vedea și rezerva facilitatea</li>
                <li>Veți primi notificări pentru rezervări noi</li>
                <li>Puteți edita detaliile oricând din contul dvs.</li>
              </ul>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h4 style="color: #92400e; margin-top: 0;">💰 Informații Financiare</h4>
              <p style="color: #92400e; margin: 0;">
                <strong>Comision Platformă:</strong> 10% din fiecare rezervare<br>
                <strong>Suma Dumneavoastră:</strong> 90% din fiecare rezervare<br>
                <strong>Plăți:</strong> Transferate conform setărilor contului bancar
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Mulțumim că faceți parte din RezervaArena!<br>
                Pentru întrebări, contactați suportul la: <strong>rezervaarena@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      subject = "🗑️ Facilitare Sportivă Ștearsă - RezervaArena";
      emailContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #dc2626; text-align: center; margin-bottom: 30px;">Facilitatea Sportivă a fost Ștearsă</h1>
            
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 25px;">
              <h2 style="color: #991b1b; margin-top: 0;">Confirmare Ștergere</h2>
              <p><strong>Proprietar:</strong> ${ownerName}</p>
              <p><strong>Data Ștergerii:</strong> ${actionDate} la ${actionTime}</p>
              ${facility ? `
                <p><strong>Nume Facilitate:</strong> ${facility.name}</p>
                <p><strong>Tip:</strong> ${facility.facility_type}</p>
                <p><strong>Orașul:</strong> ${facility.city}</p>
              ` : `<p><strong>ID Facilitate:</strong> ${facilityId}</p>`}
            </div>

            <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h3 style="color: #92400e; margin-top: 0;">📋 Ce s-a întâmplat</h3>
              <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                <li>Facilitatea a fost ștearsă din lista activă</li>
                <li>Nu mai poate primi rezervări noi</li>
                <li>Rezervările existente rămân valabile</li>
                <li>Istoricul rezervărilor este păstrat</li>
              </ul>
            </div>

            <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">🔄 Reactivare</h3>
              <p style="color: #1e40af; margin: 0;">
                Dacă doriți să reactivați facilitatea, puteți adăuga din nou o facilitate 
                similară din contul dvs. de proprietar oricând.
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Pentru întrebări sau suport, contactați-ne la: <strong>rezervaarena@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    }

    // Send facility notification email
    const emailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [ownerEmail],
      subject: subject,
      html: emailContent,
    });

    console.log("Facility notification email sent:", emailResponse);

    if (emailResponse.error) {
      console.error("Email error:", emailResponse.error);
      throw new Error("Failed to send facility notification email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Facility notification email sent successfully",
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
    console.error("Error in send-facility-notification function:", error);
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