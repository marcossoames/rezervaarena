import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';

// Initialize Google Auth for native platforms
if (Capacitor.isNativePlatform()) {
  SocialLogin.initialize({
    google: {
      webClientId: '556634083767-6e4o5otsascaohj7uu1ldgeguh9j7ljl.apps.googleusercontent.com',
    }
  });
}

/**
 * Sign in with Google - handles both web and native platforms
 */
export const signInWithGoogle = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Native mobile flow using SocialLogin plugin
      const response = await SocialLogin.login({
        provider: 'google',
        options: {}
      });
      
      if (!response || response.provider !== 'google') {
        throw new Error('Google authentication failed');
      }

      // Check if we have idToken (online mode)
      const result = response.result as any;
      if (!result.idToken) {
        throw new Error('ID token not available');
      }

      // Sign in to Supabase with the Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: result.idToken,
      });

      if (error) throw error;
      return { data, error: null };
      
    } else {
      // Web flow using standard OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-redirect`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) throw error;
      return { data, error: null };
    }
  } catch (error: any) {
    console.error('Google sign in error:', error);
    return { 
      data: null, 
      error: error.message || 'Failed to sign in with Google' 
    };
  }
};

/**
 * Sign out from Google
 */
export const signOutFromGoogle = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      await SocialLogin.logout({ provider: 'google' });
    }
    
    // Always sign out from Supabase
    await supabase.auth.signOut();
    
    return { error: null };
  } catch (error: any) {
    console.error('Google sign out error:', error);
    return { error: error.message || 'Failed to sign out' };
  }
};
