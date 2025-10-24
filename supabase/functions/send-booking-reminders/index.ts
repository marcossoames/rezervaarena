import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Booking {
  id: string;
  client_id: string;
  facility_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  facility_name: string;
  total_price: number;
  payment_method: string;
  facilities: {
    sports_complexes: {
      name: string;
      location: string;
    };
  };
}

interface Profile {
  user_id: string;
  email: string;
  full_name: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    const { type } = await req.json() as { type: '24h' | '1h' };
    
    console.log(`Processing ${type} reminders...`);

    // Calculate the target date/time based on reminder type
    const now = new Date();
    let targetDateTime: Date;
    let notificationType: string;
    
    if (type === '24h') {
      // Find bookings 24 hours from now
      targetDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      notificationType = 'booking_reminder_24h';
    } else {
      // Find bookings 1 hour from now
      targetDateTime = new Date(now.getTime() + 60 * 60 * 1000);
      notificationType = 'booking_reminder_1h';
    }

    const targetDate = targetDateTime.toISOString().split('T')[0];
    const targetTime = targetDateTime.toTimeString().split(' ')[0].substring(0, 5);

    console.log(`Looking for bookings on ${targetDate} at ${targetTime}`);

    // Get bookings that match the reminder time
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id, 
        client_id, 
        facility_id, 
        booking_date, 
        start_time, 
        end_time, 
        facility_name,
        total_price,
        payment_method,
        facilities!inner(
          sports_complexes!inner(
            name,
            location
          )
        )
      `)
      .eq('status', 'confirmed')
      .eq('booking_date', targetDate)
      .gte('start_time', targetTime)
      .lte('start_time', `${targetTime}:59`)
      .returns<Booking[]>();

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    if (!bookings || bookings.length === 0) {
      console.log('No bookings found for reminders');
      return new Response(
        JSON.stringify({ message: 'No bookings to remind', count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Found ${bookings.length} bookings to remind`);

    // Get unique client IDs
    const clientIds = [...new Set(bookings.map(b => b.client_id))];
    
    // Fetch client profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', clientIds)
      .returns<Profile[]>();

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

    // Create notifications and send emails
    let sentCount = 0;
    let emailsSent = 0;

    for (const booking of bookings) {
      const profile = profilesMap.get(booking.client_id);
      if (!profile) continue;

      const bookingDateFormatted = new Date(booking.booking_date).toLocaleDateString('ro-RO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      // Format time without seconds (HH:MM)
      const startTimeFormatted = booking.start_time.substring(0, 5);
      const endTimeFormatted = booking.end_time.substring(0, 5);

      const reminderTime = type === '24h' ? '24 de ore' : '1 oră';
      const title = type === '24h' ? 'Rezervare mâine' : 'Rezervare în curând';
      const sportsComplexName = booking.facilities?.sports_complexes?.name || booking.facility_name;
      const sportsComplexLocation = booking.facilities?.sports_complexes?.location || '';
      const message = `Ai o rezervare la ${sportsComplexName} ${type === '24h' ? 'mâine' : 'peste o oră'}, pe ${bookingDateFormatted} la ora ${startTimeFormatted}.`;
      
      // Format payment method
      const paymentMethodDisplay = booking.payment_method === 'card' ? 'Card' : 
                                   booking.payment_method === 'cash' ? 'Numerar' : 
                                   booking.payment_method;

      // Create in-app notification (for both 24h and 1h reminders)
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: booking.client_id,
          type: notificationType,
          title: title,
          message: message,
          link: '/my-reservations',
          metadata: {
            booking_id: booking.id,
            facility_id: booking.facility_id,
            booking_date: booking.booking_date,
            start_time: booking.start_time
          }
        });

      if (notifError) {
        console.error('Error creating notification:', notifError);
      } else {
        sentCount++;
        console.log(`Created in-app notification for booking ${booking.id}`);
      }

      // Send email if Resend is configured
      if (resend && profile.email) {
        try {
          await resend.emails.send({
            from: 'RezervaArena <noreply@rezervaarena.com>',
            to: [profile.email],
            subject: `Reminder: Rezervare ${reminderTime}`,
            html: `
              <!DOCTYPE html>
              <html lang="ro">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    background-color: #f5f5f5;
                    margin: 0;
                    padding: 0;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                    border-radius: 8px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  }
                  .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px 20px;
                    text-align: center;
                  }
                  .header h1 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                  }
                  .content {
                    padding: 30px 20px;
                  }
                  .greeting {
                    font-size: 18px;
                    margin-bottom: 20px;
                    color: #333;
                  }
                  .alert-box {
                    background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                  }
                  .alert-box p {
                    margin: 0;
                    font-size: 16px;
                    color: #555;
                  }
                  .details-card {
                    background-color: #f9fafb;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                  }
                  .details-title {
                    font-size: 16px;
                    font-weight: 600;
                    color: #667eea;
                    margin-bottom: 15px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                  }
                  .detail-item {
                    display: flex;
                    padding: 10px 0;
                    border-bottom: 1px solid #e5e7eb;
                  }
                  .detail-item:last-child {
                    border-bottom: none;
                  }
                  .detail-label {
                    font-weight: 600;
                    color: #4b5563;
                    min-width: 140px;
                  }
                  .detail-value {
                    color: #1f2937;
                    flex: 1;
                  }
                  .footer {
                    background-color: #f9fafb;
                    padding: 20px;
                    text-align: center;
                    color: #6b7280;
                    font-size: 14px;
                    border-top: 1px solid #e5e7eb;
                  }
                  .logo {
                    font-weight: 700;
                    color: #667eea;
                  }
                  .price-highlight {
                    font-size: 24px;
                    font-weight: 700;
                    color: #667eea;
                  }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🔔 ${title}</h1>
                  </div>
                  
                  <div class="content">
                    <p class="greeting">Bună ${profile.full_name},</p>
                    
                    <div class="alert-box">
                      <p><strong>${message}</strong></p>
                    </div>
                    
                    <div class="details-card">
                      <div class="details-title">📋 Detalii Rezervare</div>
                      
                      <div class="detail-item">
                        <div class="detail-label">📍 Locație:</div>
                        <div class="detail-value"><strong>${sportsComplexName}</strong>${sportsComplexLocation ? `<br><small style="color: #6b7280;">${sportsComplexLocation}</small>` : ''}</div>
                      </div>
                      
                      <div class="detail-item">
                        <div class="detail-label">🏟️ Teren:</div>
                        <div class="detail-value">${booking.facility_name}</div>
                      </div>
                      
                      <div class="detail-item">
                        <div class="detail-label">📅 Data:</div>
                        <div class="detail-value">${bookingDateFormatted}</div>
                      </div>
                      
                      <div class="detail-item">
                        <div class="detail-label">🕐 Interval orar:</div>
                        <div class="detail-value"><strong>${startTimeFormatted} - ${endTimeFormatted}</strong></div>
                      </div>
                      
                      <div class="detail-item">
                        <div class="detail-label">💰 Cost:</div>
                        <div class="detail-value"><span class="price-highlight">${booking.total_price} RON</span></div>
                      </div>
                      
                      <div class="detail-item">
                        <div class="detail-label">💳 Metodă plată:</div>
                        <div class="detail-value">${paymentMethodDisplay}</div>
                      </div>
                    </div>
                    
                    <p style="color: #4b5563; margin-top: 20px;">Ne vedem în curând! 🎾</p>
                  </div>
                  
                  <div class="footer">
                    <p style="margin: 0 0 5px 0;"><span class="logo">RezervaArena</span></p>
                    <p style="margin: 0; font-size: 12px;">Platforma ta pentru rezervări sportive</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          emailsSent++;
          console.log(`Sent email to ${profile.email}`);
        } catch (emailError) {
          console.error(`Error sending email to ${profile.email}:`, emailError);
        }
      }
    }

    console.log(`Reminder processing complete: ${sentCount} notifications, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({ 
        message: 'Reminders processed successfully',
        notifications_created: sentCount,
        emails_sent: emailsSent,
        bookings_processed: bookings.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in send-booking-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});