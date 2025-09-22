import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Resend } from "npm:resend@2.0.0";

// Utility function to translate facility types from English to Romanian
const getFacilityTypeLabel = (facilityType: string): string => {
  const facilityTypeLabels: Record<string, string> = {
    'football': 'Fotbal',
    'tennis': 'Tenis',
    'padel': 'Padel',
    'squash': 'Squash',
    'basketball': 'Baschet',
    'volleyball': 'Volei',
    'foot_tennis': 'Tenis de Picior',
    'ping_pong': 'Ping Pong'
  };

  return facilityTypeLabels[facilityType] || facilityType;
};

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

interface BookingConfirmationRequest {
  bookingId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Starting booking confirmation email process");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bookingId }: BookingConfirmationRequest = await req.json();
    console.log("Processing booking ID:", bookingId);

    if (!bookingId) {
      throw new Error("Booking ID is required");
    }

    // Initialize Supabase client
    const supabaseUrl = "https://ukopxkymzywfpobpcana.supabase.co";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseServiceKey) {
      throw new Error("Supabase service key not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get booking details with related data
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        *,
        facilities!bookings_facility_id_fkey (
          name,
          facility_type,
          address,
          city,
          owner_id,
          profiles!facilities_owner_id_fkey (
            full_name,
            email,
            phone,
            user_type_comment
          )
        ),
        profiles!bookings_client_id_fkey (
          full_name,
          email,
          phone
        )
      `)
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      console.error("Error fetching booking:", bookingError);
      throw new Error("Booking not found");
    }

    console.log("Booking data retrieved successfully");

    // Extract related entities with robust fallbacks (FKs may be missing)
    let clientProfile: any = (booking as any).profiles;
    const facilityData: any = (booking as any).facilities;
    let ownerProfile: any = facilityData?.profiles;

    if (!clientProfile) {
      const { data: cp, error: cpErr } = await supabase
        .from("profiles")
        .select("full_name,email,phone")
        .eq("user_id", booking.client_id)
        .single();
      if (cpErr) console.warn("Fallback fetch client profile error:", cpErr);
      clientProfile = cp || clientProfile;
    }

    if (!ownerProfile && facilityData?.owner_id) {
      const { data: op, error: opErr } = await supabase
        .from("profiles")
        .select("full_name,email,phone,user_type_comment")
        .eq("user_id", facilityData.owner_id)
        .single();
      if (opErr) console.warn("Fallback fetch owner profile error:", opErr);
      ownerProfile = op || ownerProfile;
    }

    if (!clientProfile?.email || !ownerProfile?.email) {
      throw new Error("Missing recipient email addresses (client or owner)");
    }
    // Format date and time for display
    const bookingDate = new Date(booking.booking_date).toLocaleDateString("ro-RO", {
      weekday: "long",
      year: "numeric",
      month: "long", 
      day: "numeric"
    });

    const startTime = booking.start_time.slice(0, 5); // HH:MM format
    const endTime = booking.end_time.slice(0, 5); // HH:MM format

    // Extract sports complex name
    const sportsComplexName = ownerProfile.user_type_comment && 
      ownerProfile.user_type_comment.includes(" - Proprietar bază sportivă")
      ? ownerProfile.user_type_comment.replace(" - Proprietar bază sportivă", "")
      : `Baza Sportivă ${ownerProfile.full_name} - ${facilityData.city}`;

    // Email to client
    const clientEmailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [clientProfile.email],
      subject: "✅ Confirmare Rezervare - RezervaArena",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #22c55e; text-align: center; margin-bottom: 30px;">🎉 Rezervarea ta a fost confirmată!</h1>
            
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
              <h2 style="color: #15803d; margin-top: 0;">Detalii Rezervare</h2>
              <p><strong>Cod Rezervare:</strong> #${booking.id.slice(0, 8).toUpperCase()}</p>
              <p><strong>Teren:</strong> ${facilityData.name}</p>
              <p><strong>Tip Teren:</strong> ${getFacilityTypeLabel(facilityData.facility_type)}</p>
              <p><strong>Data:</strong> ${bookingDate}</p>
              <p><strong>Ora:</strong> ${startTime} - ${endTime}</p>
              <p><strong>Preț Total:</strong> ${booking.total_price} RON</p>
              <p><strong>Metoda de Plată:</strong> ${booking.payment_method === 'cash' ? 'Cash la fața locului' : 'Online'}</p>
            </div>

            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h3 style="color: #1e40af; margin-top: 0;">Informații Locație</h3>
              <p><strong>Complexul Sportiv:</strong> ${sportsComplexName}</p>
              <p><strong>Adresa:</strong> ${facilityData.address}, ${facilityData.city}</p>
              <p><strong>Telefon Contact:</strong> ${ownerProfile.phone}</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Mulțumim că ați ales RezervaArena!<br>
                Pentru întrebări, contactați suportul la: <strong>rezervaarena@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    // Email către proprietarul terenului
    const ownerEmailResponse = await resend.emails.send({
      from: `RezervaArena <${fromEmail}>`,
      to: [ownerProfile.email],
      subject: "🔔 Rezervare Nouă Confirmată - RezervaArena",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #3b82f6; text-align: center; margin-bottom: 30px;">Rezervare Nouă Confirmată</h1>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin-top: 0;">Detalii Rezervare</h2>
              <p><strong>Cod Rezervare:</strong> #${booking.id.slice(0, 8).toUpperCase()}</p>
              <p><strong>Teren:</strong> ${facilityData.name}</p>
              <p><strong>Data:</strong> ${bookingDate}</p>
              <p><strong>Ora:</strong> ${startTime} - ${endTime}</p>
              <p><strong>Valoare:</strong> ${booking.total_price} RON</p>
              <p><strong>Metoda de Plată:</strong> ${booking.payment_method === 'cash' ? 'Cash la fața locului' : 'Online'}</p>
            </div>

            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
              <h3 style="color: #15803d; margin-top: 0;">Informații Client</h3>
              <p><strong>Nume:</strong> ${clientProfile.full_name}</p>
              <p><strong>Telefon:</strong> ${clientProfile.phone}</p>
              <p><strong>Email:</strong> ${clientProfile.email}</p>
            </div>

            <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b; margin-bottom: 25px;">
              <h4 style="color: #92400e; margin-top: 0;">💰 Detalii Financiare</h4>
              <p style="color: #92400e; margin: 0;">
                <strong>Suma Totală:</strong> ${booking.total_price} RON<br>
                <strong>Comision Platformă (10%):</strong> ${booking.platform_fee_amount} RON<br>
                <strong>Suma Dumneavoastră (90%):</strong> ${(booking.total_price - booking.platform_fee_amount).toFixed(2)} RON
              </p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Această rezervare a fost procesată prin RezervaArena<br>
                Pentru întrebări despre platformă, contactați suportul la: <strong>rezervaarena@gmail.com</strong>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Client email sent:", clientEmailResponse);
    console.log("Owner email sent:", ownerEmailResponse);

    if (clientEmailResponse.error || ownerEmailResponse.error) {
      console.error("Email errors:", {
        clientError: clientEmailResponse.error,
        ownerError: ownerEmailResponse.error
      });
      throw new Error("Failed to send one or more emails");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Booking confirmation emails sent successfully",
        emailsSent: {
          client: clientEmailResponse.data?.id,
          owner: ownerEmailResponse.data?.id
        }
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
    console.error("Error in send-booking-confirmation function:", error);
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