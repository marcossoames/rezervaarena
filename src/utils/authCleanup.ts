export const cleanupAuthState = () => {
  try {
    localStorage.removeItem('supabase.auth.token');
    
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up auth state:', error);
  }
};

export const secureSignOut = async (supabase: any) => {
  try {
    cleanupAuthState();
    
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (err) {
      // continue regardless
    }
    
    window.location.href = '/';
  } catch (error) {
    window.location.href = '/';
  }
};