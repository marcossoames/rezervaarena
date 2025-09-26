import { supabase } from "@/integrations/supabase/client";

export const checkActiveBookings = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { activeBookings: 0, error: "Nu există utilizator autentificat" };
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, facilities!bookings_facility_id_fkey(name)')
      .eq('client_id', user.id)
      .gte('booking_date', new Date().toISOString().split('T')[0])
      .in('status', ['confirmed', 'pending']);

    if (error) {
      console.error('Error checking active bookings:', error);
      return { activeBookings: 0, error: error.message };
    }

    return { 
      activeBookings: bookings?.length || 0, 
      bookings: bookings || [],
      error: null 
    };
  } catch (error: any) {
    console.error('Error checking active bookings:', error);
    return { activeBookings: 0, error: error.message };
  }
};
 
export const checkOwnerActiveFacilityBookings = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { activeBookings: 0, error: "Nu există utilizator autentificat" };
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: facilities, error: facilitiesError } = await supabase
      .from('facilities')
      .select('id,name')
      .eq('owner_id', user.id);

    if (facilitiesError) {
      console.error('Error loading facilities:', facilitiesError);
      return { activeBookings: 0, error: facilitiesError.message };
    }

    const facilityIds = facilities?.map((f: any) => f.id) || [];
    if (facilityIds.length === 0) {
      return { activeBookings: 0, bookings: [], error: null };
    }

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, facility_id, status')
      .in('facility_id', facilityIds)
      .gte('booking_date', today)
      .in('status', ['confirmed', 'pending']);

    if (error) {
      console.error('Error checking owner active facility bookings:', error);
      return { activeBookings: 0, error: error.message };
    }

    return {
      activeBookings: bookings?.length || 0,
      bookings: bookings || [],
      facilities: facilities || [],
      error: null
    };
  } catch (error: any) {
    console.error('Error checking owner active facility bookings:', error);
    return { activeBookings: 0, error: error.message };
  }
};
 
export const deleteUserAccount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Nu există utilizator autentificat");
    }

    // Use the secure deletion function that handles booking cancellation
    const { data, error } = await supabase.rpc('delete_current_user_account');

    if (error) {
      throw error;
    }

    console.log('Account deletion response:', data);

    // Extract information from the response
    const deletionResult = data as any;
    const userRole = deletionResult?.user_role;
    const userEmail = deletionResult?.user_email;
    const userName = deletionResult?.user_name;
    const cancelledBookings = deletionResult?.cancelled_bookings || 0;
    const bookingDetails = deletionResult?.booking_details || [];

    // Send cancellation emails based on user role
    if (Array.isArray(bookingDetails) && bookingDetails.length > 0) {
      try {
        console.log(`Sending cancellation emails for ${bookingDetails.length} bookings, user role: ${userRole}`);
        
        if (userRole === 'facility_owner') {
          // For facility owners: send cancellation emails to clients
          for (const booking of bookingDetails) {
            if (booking.client_email) {
              console.log(`Sending cancellation email to client ${booking.client_email} for booking ${booking.booking_id}`);
              const emailResult = await supabase.functions.invoke('send-booking-cancellation-email', {
                body: {
                  clientEmails: [booking.client_email],
                  facilityName: booking.facility_name,
                  reason: 'Proprietarul bazei sportive și-a șters contul',
                  cancelledBy: 'facility',
                  bookingDetails: {
                    date: new Date(booking.booking_date).toLocaleDateString("ro-RO"),
                    time: `${booking.start_time?.slice(0, 5)} - ${booking.end_time?.slice(0, 5)}`,
                    price: booking.total_price
                  }
                }
              });
              
              if (emailResult.error) {
                console.error(`Cancellation email error for client ${booking.client_email}:`, emailResult.error);
              } else {
                console.log(`Cancellation email sent successfully to client ${booking.client_email}`);
              }
            }
          }
        } else if (userRole === 'client') {
          // For clients: send cancellation notifications to facility owners
          const facilityOwnerEmails = [...new Set(bookingDetails
            .map((booking: any) => booking.facility_owner_email)
            .filter(Boolean))];
          
          console.log(`Notifying ${facilityOwnerEmails.length} facility owners about client account deletion`);
          
          for (const ownerEmail of facilityOwnerEmails) {
            const ownerBookings = bookingDetails.filter((booking: any) => 
              booking.facility_owner_email === ownerEmail
            );
            
            if (ownerBookings.length > 0) {
              console.log(`Sending notification to facility owner ${ownerEmail} about ${ownerBookings.length} cancelled bookings`);
              // Send notification to facility owner about client cancellations
              const emailResult = await supabase.functions.invoke('send-facility-owner-notification', {
                body: {
                  facilityOwnerEmail: ownerEmail,
                  subject: 'Rezervări anulate - Client a șters contul',
                  message: `Un client și-a șters contul și a anulat ${ownerBookings.length} rezervare(i).`,
                  bookings: ownerBookings.map((booking: any) => ({
                    facility_name: booking.facility_name,
                    booking_date: new Date(booking.booking_date).toLocaleDateString("ro-RO"),
                    start_time: booking.start_time?.slice(0, 5),
                    end_time: booking.end_time?.slice(0, 5),
                    total_price: booking.total_price
                  }))
                }
              });
              
              if (emailResult.error) {
                console.error(`Facility owner notification error for ${ownerEmail}:`, emailResult.error);
              } else {
                console.log(`Facility owner notification sent successfully to ${ownerEmail}`);
              }
            }
          }
        }
      } catch (emailError) {
        console.error('Error sending cancellation emails:', emailError);
        // Don't fail the deletion if email fails
      }
    }

    // Send deletion confirmation email 
    if (userEmail && userName) {
      try {
        console.log('Attempting to send deletion confirmation email to:', userEmail);
        const emailResult = await supabase.functions.invoke('send-account-deletion-email', {
          body: {
            userId: user.id,
            userEmail: userEmail,
            userName: userName,
            userType: userRole === 'client' ? 'client' : 'facility_owner',
            cancelledBookings: cancelledBookings,
            deactivatedFacilities: userRole === 'facility_owner' ? 1 : 0
          }
        });
        
        console.log('Email function response:', emailResult);
        
        if (emailResult.error) {
          console.error('Email function error:', emailResult.error);
        } else {
          console.log('Deletion confirmation email sent successfully to:', userEmail);
        }
      } catch (emailError) {
        console.error('Error sending deletion email:', emailError);
        // Don't fail the deletion if email fails
      }
    }

    // IMPORTANT: Profiles and users are preserved to keep booking history
    // Only facilities are deactivated and bookings cancelled - not deleted
    console.log('Account deletion process completed - bookings preserved in history');
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete account error:', error);
    return { 
      success: false, 
      error: error.message || "A apărut o eroare la ștergerea contului" 
    };
  }
};