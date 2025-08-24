/**
 * Comprehensive auth state cleanup utility to prevent authentication limbo states
 * This utility clears all auth-related keys from browser storage
 */
export const cleanupAuthState = () => {
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
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
    
    console.log('Auth state cleaned up successfully');
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

/**
 * Secure sign-out with complete state cleanup
 */
export const secureSignOut = async (supabase: any) => {
  try {
    // Clean up first
    cleanupAuthState();
    
    // Attempt global sign out
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.warn('Sign out error (continuing):', err);
    }
    
    // Force page reload for clean state
    window.location.href = '/';
  } catch (error) {
    console.error('Secure sign out error:', error);
    // Force reload anyway
    window.location.href = '/';
  }
};