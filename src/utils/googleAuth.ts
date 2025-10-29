import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { supabase } from '@/integrations/supabase/client';

// Initialize Google Auth for native platforms
if (Capacitor.isNativePlatform()) {
  console.log('Initializing SocialLogin for native platform...');
  try {
    SocialLogin.initialize({
      google: {
        webClientId: '556634083767-6e4o5otsascaohj7uu1ldgeguh9j7ljl.apps.googleusercontent.com'
      }
    });
    console.log('SocialLogin initialized successfully');
  } catch (error) {
    console.error('Failed to initialize SocialLogin:', error);
  }
}

/**
 * Sign in with Google - handles both web and native platforms
 */
export const signInWithGoogle = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Native mobile flow using SocialLogin plugin
      console.log('Starting native Google login...');
      console.log('Platform info:', Capacitor.getPlatform());
      
      try {
        const response = await SocialLogin.login({
          provider: 'google',
          options: {
            scopes: ['profile', 'email']
          }
        });
        
        console.log('Google login response received:', JSON.stringify(response, null, 2));
        
        if (!response || response.provider !== 'google') {
          throw new Error('Google authentication failed - invalid response from plugin');
        }

        // Check if we have idToken
        const result = response.result as any;
        console.log('Response result keys:', Object.keys(result || {}));
        console.log('Has idToken:', !!result?.idToken);
        
        if (!result?.idToken) {
          console.error('Missing idToken in response. Full result:', JSON.stringify(result, null, 2));
          throw new Error('Google authentication failed - no ID token received. Verifică configurarea Google OAuth în Supabase Dashboard.');
        }

        // Sign in to Supabase with the Google ID token
        console.log('Signing in to Supabase with Google token...');
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.idToken,
        });

        if (error) {
          console.error('Supabase sign in error:', error);
          throw error;
        }
        
        console.log('Google sign in successful!');
        return { data, error: null };
      } catch (pluginError: any) {
        console.error('SocialLogin plugin error:', pluginError);
        console.error('Error details:', JSON.stringify(pluginError, null, 2));
        
        // Re-throw with more context
        if (pluginError.message?.includes('Load failed')) {
          throw new Error('Eroare la încărcarea Google Sign In. Verifică conexiunea la internet și configurarea aplicației.');
        }
        throw pluginError;
      }
      
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
    console.error('Error type:', typeof error);
    console.error('Error stack:', error.stack);
    
    let errorMessage = 'Autentificarea cu Google a eșuat';
    
    // Detect specific error types
    const errorString = error.message || error.error_description || JSON.stringify(error);
    
    if (errorString.includes('Load failed') || errorString.includes('încărcare')) {
      errorMessage = '❌ Eroare la încărcarea Google Sign In. Asigură-te că:\n1. Ai conexiune la internet\n2. Google Client ID este corect configurat în Supabase\n3. Aplicația are permisiunile necesare';
    } else if (errorString.includes('redirect_uri_mismatch')) {
      errorMessage = '❌ Eroare de configurare Google Cloud: Redirect URI invalid. Verifică pagina /auth-diagnostics pentru detalii.';
    } else if (errorString.includes('id_token') && errorString.includes('aud')) {
      errorMessage = '❌ Eroare de configurare Supabase: Client ID necorespunzător. Verifică pagina /auth-diagnostics pentru detalii.';
    } else if (errorString.includes('idToken') || errorString.includes('id_token')) {
      errorMessage = '❌ Token ID lipsă sau invalid. Încearcă din nou sau verifică configurarea.';
    } else if (errorString.includes('canceled') || errorString.includes('cancelled')) {
      errorMessage = 'Ai anulat autentificarea cu Google.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      data: null, 
      error: errorMessage
    };
  }
};

/**
 * Sign in with Apple - handles both web and native platforms
 */
export const signInWithApple = async () => {
  try {
    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
      // Native mobile flow using SocialLogin plugin
      console.log('Starting native Apple login...');
      
      const response = await SocialLogin.login({
        provider: 'apple',
        options: {
          scopes: ['email', 'name']
        }
      });
      
      console.log('Apple login response:', response);
      
      if (!response || response.provider !== 'apple') {
        throw new Error('Apple authentication failed - invalid response');
      }

      const result = response.result as any;
      const idToken = result?.idToken || result?.identityToken || result?.token || result?.credential?.idToken;
      console.log('Apple token present:', !!idToken);
      
      if (!idToken) {
        console.error('Missing Apple idToken in response:', result);
        throw new Error('Apple authentication failed - no ID token received. Please try again.');
      }

      // Sign in to Supabase with the Apple ID token
      const nonce = result?.nonce || result?.state;
      console.log('Signing in to Supabase with Apple token...');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        nonce
      });

      if (error) {
        console.error('Supabase sign in error:', error);
        throw error;
      }
      
      console.log('Apple sign in successful!');
      return { data, error: null };
      
    } else {
      // Web flow using standard OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth-redirect`,
          queryParams: {
            // Ensure the authorization code is returned in the query string
            response_mode: 'query'
          },
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
      errorMessage = '❌ Eroare de configurare Apple: Redirect URI invalid. Verifică configurarea în Supabase Dashboard.';
    } else if (errorString.includes('ASAuthorizationError') || errorString.includes('AuthorizationError')) {
      if (/1001/.test(errorString) || /canceled/i.test(errorString)) {
        errorMessage = 'Ai anulat autentificarea cu Apple.';
      } else if (/1000/.test(errorString)) {
        errorMessage = 'Eroare Apple necunoscută (1000). Verifică să fii autentificat în iCloud și că „Sign in with Apple” este activ pe dispozitiv.';
      }
    } else if (errorString.includes('id_token') && errorString.includes('aud')) {
      errorMessage = '❌ Eroare de configurare Supabase: Client ID Apple necorespunzător.';
    } else if (errorString.includes('idToken') || errorString.includes('id_token')) {
      errorMessage = '❌ Token ID lipsă sau invalid. Încearcă din nou sau verifică configurarea.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      data: null, 
      error: errorMessage
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
