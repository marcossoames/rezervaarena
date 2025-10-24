import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { supabase } from '@/integrations/supabase/client';

// Initialize Google Auth for native platforms
if (Capacitor.isNativePlatform()) {
  GoogleAuth.initialize({
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Replace with your actual Client ID
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

/**
 * Sign in with Google - handles both web and native platforms
 */
export const signInWithGoogle = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Native mobile flow using GoogleAuth plugin
      const googleUser = await GoogleAuth.signIn();
      
      if (!googleUser || !googleUser.authentication) {
        throw new Error('Google authentication failed');
      }

      // Sign in to Supabase with the Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: googleUser.authentication.idToken,
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
      await GoogleAuth.signOut();
    }
    
    // Always sign out from Supabase
    await supabase.auth.signOut();
    
    return { error: null };
  } catch (error: any) {
    console.error('Google sign out error:', error);
    return { error: error.message || 'Failed to sign out' };
  }
};
