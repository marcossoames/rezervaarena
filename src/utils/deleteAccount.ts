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

    // Send deletion confirmation email AFTER successful deletion
    if (profile?.email && profile?.full_name) {
      try {
        
        await supabase.functions.invoke('send-account-deletion-email', {
          body: {
            userId: user.id,
            userEmail: profile.email,
            userName: profile.full_name,
            userType: profile.role === 'client' ? 'client' : 'facility_owner'
          }
        });
      } catch (emailError) {
        console.error('Error sending deletion email:', emailError);
        // Don't fail the deletion if email fails
      }
    }

    // Sign out the user after successful deletion
    await supabase.auth.signOut();
    await supabase.auth.signOut({ scope: 'local' });
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete account error:', error);
    
    // Check if error is about active bookings
    if (error.message && error.message.includes('ACTIVE_BOOKINGS_EXIST')) {
      return { 
        success: false, 
        hasActiveBookings: true,
        error: "Nu poți șterge contul cât timp ai rezervări active. Te rugăm să anulezi manual toate rezervările înainte." 
      };
    }
    
    return { 
      success: false, 
      hasActiveBookings: false,
      error: error.message || "A apărut o eroare la ștergerea contului" 
    };
  }
};