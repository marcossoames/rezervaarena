import { supabase } from "@/integrations/supabase/client";

export const deleteUserAccount = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Nu există utilizator autentificat");
    }

    // Delete profile first (this should cascade properly due to foreign keys)
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    // Then sign out the user
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw signOutError;
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