import { supabase } from "@/integrations/supabase/client";

/**
 * Comprehensive auth state cleanup utility to prevent authentication limbo states
 */
export const cleanupAuthState = () => {
  try {
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });

    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.warn('Error cleaning up auth state:', error);
  }
};

/**
 * Robust sign out with complete state cleanup
 */
export const robustSignOut = async () => {
  try {
    // Clean up auth state first
    cleanupAuthState();
    
    // Attempt global sign out (continue even if it fails)
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('Sign out error (continuing):', err);
    }
    
    // Force page reload for clean state
    window.location.href = '/auth';
  } catch (error) {
    console.error('Error during sign out:', error);
    // Force reload anyway
    window.location.href = '/auth';
  }
};

/**
 * Safe sign in with state cleanup
 */
export const safeSignIn = async (email: string, password: string) => {
  try {
    // Clean up existing state
    cleanupAuthState();
    
    // Attempt global sign out first
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      // Continue even if this fails
    }
    
    // Sign in with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Force page reload for clean state
    if (data.user) {
      window.location.href = '/';
    }
    
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
};