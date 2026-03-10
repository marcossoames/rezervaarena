import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';

if (Capacitor.isNativePlatform()) {
  try {
    SocialLogin.initialize({
      google: {
        webClientId: '556634083767-6e4o5otsascaohj7uu1ldgeguh9j7ljl.apps.googleusercontent.com'
      }
    });
  } catch (error) {
    console.error('Failed to initialize SocialLogin:', error);
  }
}

export const signInWithGoogle = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      try {
        const response = await SocialLogin.login({
          provider: 'google',
          options: { scopes: ['profile', 'email'] }
        });
        
        if (!response || response.provider !== 'google') {
          throw new Error('Google authentication failed - invalid response');
        }

        const result = response.result as any;
        if (!result?.idToken) {
          throw new Error('Google authentication failed - no ID token received');
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });

        if (error) throw error;
        return { data, error: null };
      } catch (pluginError: any) {
        if (pluginError.message?.includes('Load failed')) {
          throw new Error('Eroare la încărcarea Google Sign In. Verifică conexiunea la internet și configurarea aplicației.');
        }
        throw pluginError;
      }
    } else {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth-redirect`,
          queryParams: { access_type: 'offline', prompt: 'consent' }
        }
      });

      if (error) throw error;
      return { data, error: null };
    }
  } catch (error: any) {
    console.error('Google sign in error:', error);
    
    let errorMessage = 'Autentificarea cu Google a eșuat';
    const errorString = error.message || error.error_description || JSON.stringify(error);
    
    if (errorString.includes('Load failed') || errorString.includes('încărcare')) {
      errorMessage = 'Eroare la încărcarea Google Sign In. Asigură-te că ai conexiune la internet.';
    } else if (errorString.includes('redirect_uri_mismatch')) {
      errorMessage = 'Eroare de configurare Google Cloud: Redirect URI invalid.';
    } else if (errorString.includes('canceled') || errorString.includes('cancelled')) {
      errorMessage = 'Ai anulat autentificarea cu Google.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { data: null, error: errorMessage };
  }
};

export const signInWithApple = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      const response = await SocialLogin.login({
        provider: 'apple',
        options: { scopes: ['email', 'name'] }
      });
      
      if (!response || response.provider !== 'apple') {
        throw new Error('Apple authentication failed - invalid response');
      }

      const result = response.result as any;
      const idToken = result?.idToken || result?.identityToken || result?.token || result?.credential?.idToken;
      
      if (!idToken) {
        throw new Error('Apple authentication failed - no ID token received');
      }

      const nonce = result?.nonce || result?.state;
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce
      });

      if (error) throw error;
      return { data, error: null };
    } else {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth-redirect`,
          queryParams: { response_mode: 'query' },
        }
      });

      if (error) throw error;
      return { data, error: null };
    }
  } catch (error: any) {
    console.error('Apple sign in error:', error);
    
    let errorMessage = 'Autentificarea cu Apple a eșuat';
    const errorString = error.message || error.error_description || JSON.stringify(error);
    
    if (errorString.includes('redirect_uri_mismatch')) {
      errorMessage = 'Eroare de configurare Apple: Redirect URI invalid.';
    } else if (/1001/.test(errorString) || /canceled/i.test(errorString)) {
      errorMessage = 'Ai anulat autentificarea cu Apple.';
    } else if (/1000/.test(errorString)) {
      errorMessage = 'Eroare Apple necunoscută. Verifică să fii autentificat în iCloud.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { data: null, error: errorMessage };
  }
};

export const signOutFromGoogle = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await SocialLogin.logout({ provider: 'google' });
    }
    await supabase.auth.signOut();
    return { error: null };
  } catch (error: any) {
    console.error('Google sign out error:', error);
    return { error: error.message || 'Failed to sign out' };
  }
};