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

    // Collect data for notifying facility owners if this is a client with active bookings
    let facilityOwnerNotifications: any[] = [];
    if (profile?.role === 'client' && activeBookingsData.activeBookings > 0) {
      try {
        const { data: clientBookings } = await supabase
          .from('bookings')
          .select(`
            id,
            booking_date,
            start_time,
            end_time,
            total_price,
            facility_id,
            facilities:facility_id (
              name,
              owner_id,
              profiles:owner_id (
                email,
                full_name
              )
            )
          `)
          .eq('client_id', user.id)
          .gte('booking_date', new Date().toISOString().split('T')[0])
          .in('status', ['confirmed', 'pending']);

        if (clientBookings && clientBookings.length > 0) {
          // Group bookings by facility owner
          const ownerBookingsMap = new Map();
          
          clientBookings.forEach((booking: any) => {
            const ownerId = booking.facilities?.owner_id;
            const ownerEmail = booking.facilities?.profiles?.email;
            const ownerName = booking.facilities?.profiles?.full_name;
            
            if (ownerId && ownerEmail) {
              if (!ownerBookingsMap.has(ownerId)) {
                ownerBookingsMap.set(ownerId, {
                  ownerEmail,
                  ownerName,
                  bookings: []
                });
              }
              
              ownerBookingsMap.get(ownerId).bookings.push({
                facilityName: booking.facilities?.name,
                bookingDate: new Date(booking.booking_date).toLocaleDateString("ro-RO"),
                bookingTime: `${booking.start_time?.slice(0, 5)} - ${booking.end_time?.slice(0, 5)}`,
                totalPrice: booking.total_price
              });
            }
          });

          facilityOwnerNotifications = Array.from(ownerBookingsMap.values());
        }
      } catch (error) {
        console.error('Error collecting facility owner notifications:', error);
      }
    }

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

    // Use the secure deletion edge function
    const { error } = await supabase.functions.invoke('delete-user-account', {
      body: {
        userId: user.id,
        userEmail: user.email || profile?.email || '',
        userType: profile?.role === 'client' ? 'client' : 'facility_owner'
      }
    });

    if (error) {
      throw error;
    }

    // Send cancellation emails to clients AFTER successful deletion if facility owner deleted account
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

    // Send notifications to facility owners if client deleted their account
    if (facilityOwnerNotifications.length > 0) {
      try {
        for (const ownerData of facilityOwnerNotifications) {
          const emailResult = await supabase.functions.invoke('send-facility-owner-notification', {
            body: {
              ownerEmail: ownerData.ownerEmail,
              ownerName: ownerData.ownerName,
              clientName: profile?.full_name || 'Client',
              reason: 'Clientul și-a șters contul',
              bookings: ownerData.bookings
            }
          });
          
          if (emailResult.error) {
            console.error(`Facility owner notification error for ${ownerData.ownerEmail}:`, emailResult.error);
          } else {
            console.log(`Facility owner notification sent successfully to ${ownerData.ownerEmail}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending facility owner notifications:', emailError);
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