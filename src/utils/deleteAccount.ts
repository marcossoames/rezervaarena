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
        // Get client emails for bookings that will be cancelled
        const { data: bookingData } = await supabase
          .from('bookings')
          .select(`
            id,
            client_id,
            booking_date,
            start_time,
            profiles!bookings_client_id_fkey(email),
            facilities!bookings_facility_id_fkey(name)
          `)
          .in('facility_id', ownerFacilitiesData.facilities?.map((f: any) => f.id) || [])
          .gte('booking_date', new Date().toISOString().split('T')[0])
          .in('status', ['confirmed', 'pending']);

        if (bookingData && bookingData.length > 0) {
          cancellationData = {
            bookingIds: bookingData.map((b: any) => b.id),
            clientEmails: [...new Set(bookingData.map((b: any) => b.profiles?.email).filter(Boolean))],
            facilityNames: [...new Set(bookingData.map((b: any) => b.facilities?.name).filter(Boolean))],
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
    if (cancellationData && cancellationData.clientEmails.length > 0) {
      try {
        const emailResult = await supabase.functions.invoke('send-booking-cancellation-email', {
          body: {
            bookingIds: cancellationData.bookingIds,
            clientEmails: cancellationData.clientEmails,
            facilityName: cancellationData.facilityNames.join(', '),
            reason: cancellationData.reason
          }
        });
        
        if (emailResult.error) {
          console.error('Cancellation email function error:', emailResult.error);
        } else {
          console.log('Cancellation emails sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending cancellation emails:', emailError);
        // Don't fail the deletion if email fails
      }
    }

    // Send deletion confirmation email AFTER successful deletion
    if (profile?.email && profile?.full_name) {
      try {
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
        
        if (emailResult.error) {
          console.error('Email function error:', emailResult.error);
        } else {
          console.log('Deletion confirmation email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending deletion email:', emailError);
        // Don't fail the deletion if email fails
      }
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