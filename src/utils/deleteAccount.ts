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

    // Get user profile before deletion
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('user_id', user.id)
      .single();

    // Check active bookings and facilities before deletion
    const activeBookingsData = await checkActiveBookings();
    const ownerFacilitiesData = await checkOwnerActiveFacilityBookings();

    // If this is a facility owner with bookings, collect cancellation email data
    let cancellationData = null;
    if (profile?.role === 'facility_owner' && ownerFacilitiesData.activeBookings > 0) {
      try {
        // Get booking details with client information for cancellation emails
        const { data: bookingData } = await supabase
          .from('bookings')
          .select(`
            id, 
            client_id, 
            facility_id, 
            booking_date, 
            start_time,
            end_time,
            total_price,
            profiles:client_id (email, full_name),
            facilities:facility_id (name)
          `)
          .in('facility_id', ownerFacilitiesData.facilities?.map((f: any) => f.id) || [])
          .gte('booking_date', new Date().toISOString().split('T')[0])
          .in('status', ['confirmed', 'pending']);

        if (bookingData && bookingData.length > 0) {
          // Get complete client and facility information for each booking
          const bookingDetails = bookingData.map((booking: any) => ({
            bookingId: booking.id,
            clientEmail: booking.profiles?.email,
            clientName: booking.profiles?.full_name,
            facilityName: booking.facilities?.name,
            bookingDate: new Date(booking.booking_date).toLocaleDateString("ro-RO"),
            bookingTime: `${booking.start_time?.slice(0, 5)} - ${booking.end_time?.slice(0, 5)}`,
            totalPrice: booking.total_price
          })).filter(booking => booking.clientEmail); // Only include bookings with valid client emails

          cancellationData = {
            bookings: bookingDetails,
            reason: 'Proprietarul bazei sportive și-a șters contul'
          };
        }
      } catch (emailError) {
        console.error('Error collecting cancellation data:', emailError);
        // Don't fail deletion if email collection fails
      }
    }

    // Use the secure deletion function
    const { data, error } = await supabase.rpc('delete_current_user_account');

    if (error) {
      throw error;
    }

    // Send cancellation emails AFTER successful deletion if needed
    if (cancellationData && cancellationData.bookings && cancellationData.bookings.length > 0) {
      try {
        // Send individual cancellation emails for each booking
        for (const booking of cancellationData.bookings) {
          const emailResult = await supabase.functions.invoke('send-booking-cancellation-email', {
            body: {
              clientEmails: [booking.clientEmail],
              facilityName: booking.facilityName,
              reason: cancellationData.reason,
              bookingDetails: {
                date: booking.bookingDate,
                time: booking.bookingTime,
                price: booking.totalPrice
              }
            }
          });
          
          if (emailResult.error) {
            console.error(`Cancellation email error for ${booking.clientEmail}:`, emailResult.error);
          } else {
            console.log(`Cancellation email sent successfully to ${booking.clientEmail}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending cancellation emails:', emailError);
        // Don't fail the deletion if email fails
      }
    }

    // Send deletion confirmation email AFTER successful deletion
    if (profile?.email && profile?.full_name) {
      try {
        console.log('Attempting to send deletion confirmation email to:', profile.email);
        const emailResult = await supabase.functions.invoke('send-account-deletion-email', {
          body: {
            userId: user.id,
            userEmail: profile.email,
            userName: profile.full_name,
            userType: profile.role === 'client' ? 'client' : 'facility_owner',
            cancelledBookings: activeBookingsData.activeBookings + (ownerFacilitiesData.activeBookings || 0),
            deactivatedFacilities: ownerFacilitiesData.facilities?.length || 0
          }
        });
        
        console.log('Email function response:', emailResult);
        
        if (emailResult.error) {
          console.error('Email function error:', emailResult.error);
        } else {
          console.log('Deletion confirmation email sent successfully to:', profile.email);
        }
      } catch (emailError) {
        console.error('Error sending deletion email:', emailError);
        // Don't fail the deletion if email fails
      }
    } else {
      console.log('Skipping deletion email - missing profile data:', { 
        email: profile?.email, 
        name: profile?.full_name 
      });
    }

    // Sign out the user after successful deletion
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Sign out error after deletion:', signOutError);
      // Don't throw here since account was already deleted successfully
      // User will still be redirected but might need manual refresh
    }

    // Force clear local session data
    await supabase.auth.signOut({ scope: 'local' });
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete account error:', error);
    return { 
      success: false, 
      error: error.message || "A apărut o eroare la ștergerea contului" 
    };
  }
};