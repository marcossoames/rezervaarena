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
      .select('id, client_id, facility_id, booking_date, start_time, end_time, facility_name')
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

      const reminderTime = type === '24h' ? '24 de ore' : '1 oră';
      const title = type === '24h' ? 'Rezervare mâine' : 'Rezervare în curând';
      const message = `Ai o rezervare la ${booking.facility_name} ${type === '24h' ? 'mâine' : 'peste o oră'}, pe ${bookingDateFormatted} la ora ${booking.start_time}.`;

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
              <h1>${title}</h1>
              <p>Bună ${profile.full_name},</p>
              <p>${message}</p>
              <p><strong>Detalii rezervare:</strong></p>
              <ul>
                <li>Locație: ${booking.facility_name}</li>
                <li>Data: ${bookingDateFormatted}</li>
                <li>Ora: ${booking.start_time} - ${booking.end_time}</li>
              </ul>
              <p>Ne vedem în curând!</p>
              <p>Echipa RezervaArena</p>
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