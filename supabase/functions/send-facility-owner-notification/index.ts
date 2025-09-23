import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FacilityOwnerNotificationRequest {
  ownerEmail: string;
  ownerName: string;
  facilityName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  bookingDate: string;
  bookingTime: string;
  totalPrice: number;
  notificationType: 'booking_confirmed' | 'booking_cancelled';
  cancellationReason?: string;
  bookingId?: string;
  paymentMethod?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting facility owner notification email process");

    const {
      ownerEmail,
      ownerName,
      facilityName,
      clientName,
      clientEmail,
      clientPhone,
      bookingDate,
      bookingTime,
      totalPrice,
      notificationType,
      cancellationReason,
      bookingId,
      paymentMethod
    }: FacilityOwnerNotificationRequest = await req.json();

    console.log("Facility owner notification request:", {
      ownerEmail,
      facilityName,
      clientName,
      notificationType
    });

    const currentDate = new Date().toLocaleDateString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    let subject: string;
    let htmlContent: string;

    if (notificationType === 'booking_confirmed') {
      subject = `Rezervare nouă confirmată - ${facilityName}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #3b82f6; text-align: center; margin-bottom: 30px; font-size: 32px;">Rezervare Nouă Confirmată</h1>
            
            <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin-top: 0;">Detalii Rezervare</h2>
              <p><strong>Cod Rezervare:</strong> #${bookingId ? bookingId.slice(0, 8).toUpperCase() : 'N/A'}</p>
              <p><strong>Teren:</strong> ${facilityName}</p>
              <p><strong>Data:</strong> ${bookingDate}</p>
              <p><strong>Ora:</strong> ${bookingTime}</p>
              <p><strong>Valoare:</strong> ${totalPrice} RON</p>
              <p><strong>Metoda de Plată:</strong> ${paymentMethod === 'cash' ? 'Cash la fața locului' : 'Online'}</p>
            </div>

            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin-bottom: 25px;">
              <h3 style="color: #15803d; margin-top: 0;">Informații Client</h3>
              <p><strong>Nume:</strong> ${clientName}</p>
              <p><strong>Telefon:</strong> ${clientPhone || 'Telefon necompletat'}</p>
              <p><strong>Email:</strong> ${clientEmail}</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #666; font-size: 14px;">
                Cu respect,<br>
                <strong>Echipa RezervArena</strong>
              </p>
            </div>
          </div>
        </div>
      `;
    } else {
      subject = `Rezervare anulată - ${facilityName}`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Rezervare anulată</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">RezervArena</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Rezervare anulată</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <h2 style="color: #dc3545; margin-top: 0;">O rezervare a fost anulată</h2>
            
            <p>Bună ziua, <strong>${ownerName}</strong>,</p>
            
            <p>O rezervare pentru facilitatea ta <strong>${facilityName}</strong> a fost anulată.</p>
            
            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #721c24;">Detalii rezervare anulată:</h3>
              <p style="margin: 8px 0;"><strong>Client:</strong> ${clientName}</p>
              <p style="margin: 8px 0;"><strong>Email client:</strong> ${clientEmail}</p>
              <p style="margin: 8px 0;"><strong>Data:</strong> ${bookingDate}</p>
              <p style="margin: 8px 0;"><strong>Ora:</strong> ${bookingTime}</p>
              <p style="margin: 8px 0;"><strong>Valoare:</strong> ${totalPrice} RON</p>
              ${cancellationReason ? `<p style="margin: 8px 0;"><strong>Motiv anulare:</strong> ${cancellationReason}</p>` : ''}
            </div>
            
            <p><strong>Data anulării:</strong> ${currentDate}</p>
            
            <p>Slotul de timp a devenit din nou disponibil pentru alte rezervări. Clientul a fost notificat despre anularea rezervării.</p>
            
            <p>Pentru orice întrebări, ne poți contacta:</p>
            <ul>
              <li>Email: <a href="mailto:contact@rezervaarena.com">contact@rezervaarena.com</a></li>
              <li>Telefon: <a href="tel:+40720059535">+40720059535</a></li>
            </ul>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;"></div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Cu respect,<br>
              <strong>Echipa RezervArena</strong>
            </p>
          </div>
        </body>
        </html>
      `;
    }

    const emailResult = await resend.emails.send({
      from: "RezervArena <noreply@rezervaarena.com>",
      to: [ownerEmail],
      subject: subject,
      html: htmlContent,
    });

    if (emailResult.error) {
      console.error(`Failed to send notification email to facility owner:`, emailResult.error);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error.message }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Facility owner notification email sent successfully:`, emailResult.data);

    return new Response(
      JSON.stringify({
        success: true,
        emailId: (emailResult.data as any)?.id,
        message: "Facility owner notification email sent successfully",
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
    console.error("Error in send-facility-owner-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);