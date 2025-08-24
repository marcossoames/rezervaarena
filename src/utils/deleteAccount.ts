import { supabase } from "@/integrations/supabase/client";

export const deleteUserAccount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Nu există utilizator autentificat");
    }

    // Use the secure deletion function
    const { data, error } = await supabase.rpc('delete_current_user_account');

    if (error) {
      throw error;
    }

    // Sign out the user after successful deletion
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error('Sign out error after deletion:', signOutError);
      // Don't throw here since account was already deleted
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Delete account error:', error);
    return { 
      success: false, 
      error: error.message || "A apărut o eroare la ștergerea contului" 
    };
  }
};