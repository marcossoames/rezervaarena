import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      const { hash, search } = window.location;
      
      // Check for password recovery FIRST (must have type=recovery)
      const hasRecoveryParams = /type=recovery/.test(hash) || /type=recovery/.test(search);
      
      // Check for email confirmation (type=signup)
      const hasSignupParams = /type=signup/.test(hash) || /type=signup/.test(search);

      if (hasRecoveryParams) {
        navigate('/reset-password' + (search || '') + (hash || ''), { replace: true });
        return;
      }
      if (hasSignupParams) {
        navigate('/email-confirmation' + (search || '') + (hash || ''), { replace: true });
        return;
      }

      // Handle OAuth code exchange (Apple PKCE flow or other OAuth flows)
      const hasOAuthCode = /[?&]code=/.test(search) || /code=/.test(hash);
      if (hasOAuthCode) {
        try {
          console.log('Processing OAuth code exchange...');
          await supabase.auth.exchangeCodeForSession(window.location.href);
          console.log('OAuth code exchange completed');
        } catch (e) {
          console.error('OAuth code exchange failed:', e);
        }
      }

      // Wait longer for OAuth code exchange to complete before checking session
      if (hasOAuthCode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Check if user is authenticated (Google/Apple OAuth or other auth)
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session after redirect:', !!session?.user);
      
      // CRITICAL: Give the session time to persist properly before checking profile
      if (session?.user) {
        console.log('User authenticated, processing profile check...');
        // Wait a moment for session to fully persist in localStorage
        await new Promise(resolve => setTimeout(resolve, 800));
        // Check if user has a complete profile with phone number
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // CRITICAL: Always redirect to complete-profile if phone is missing or invalid
        // This includes: new users, deleted accounts that were recreated, or incomplete profiles
        const hasValidPhone = profile?.phone && 
                            profile.phone !== 'Telefon necompletat' && 
                            profile.phone.trim() !== '';

        if (!hasValidPhone) {
          console.log('Redirecting to complete profile - phone missing or invalid');
          navigate('/complete-profile', { replace: true });
          return;
        }

        console.log('User has complete profile, redirecting to home');
        
        // Force a brief delay to ensure session state propagates to the app
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check if there's a redirect location stored
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath, { replace: true });
          return;
        }
        
        // Navigate to home
        navigate('/', { replace: true });
        return;
      }

      // Default: go home (no session)
      navigate('/', { replace: true });
    };

    handleRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default AuthRedirect;
