import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      const { hash, search } = window.location;
      const hasRecoveryParams = /type=recovery|token_hash=|access_token=|refresh_token=/.test(hash) || /type=recovery|token_hash=|access_token=|refresh_token=/.test(search);
      const hasSignupParams = /(type=signup|code=|token_hash=|access_token=)/.test(hash) || /(type=signup|code=|token_hash=|access_token=)/.test(search);

      if (hasRecoveryParams) {
        navigate('/reset-password' + (search || '') + (hash || ''), { replace: true });
        return;
      }
      if (hasSignupParams) {
        navigate('/email-confirmation' + (search || '') + (hash || ''), { replace: true });
        return;
      }

      // Check if user is authenticated (Google OAuth)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if user has a complete profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('user_id', session.user.id)
          .single();

        // If no profile or missing phone, redirect to complete profile
        if (!profile || !profile.phone) {
          navigate('/complete-profile', { replace: true });
          return;
        }
      }

      // Default: go home
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
