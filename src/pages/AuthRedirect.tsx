import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      const { hash, search } = window.location;
      
      if (/type=recovery/.test(hash) || /type=recovery/.test(search)) {
        navigate('/reset-password' + (search || '') + (hash || ''), { replace: true });
        return;
      }
      if (/type=signup/.test(hash) || /type=signup/.test(search)) {
        navigate('/email-confirmation' + (search || '') + (hash || ''), { replace: true });
        return;
      }

      const hasOAuthCode = /[?&]code=/.test(search) || /code=/.test(hash);
      if (hasOAuthCode) {
        try {
          await supabase.auth.exchangeCodeForSession(window.location.href);
        } catch (e) {
          console.error('OAuth code exchange failed:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('user_id', session.user.id)
          .maybeSingle();

        const hasValidPhone = profile?.phone && 
                            profile.phone !== 'Telefon necompletat' && 
                            profile.phone.trim() !== '';

        if (!hasValidPhone) {
          navigate('/complete-profile', { replace: true });
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath, { replace: true });
          return;
        }
        
        navigate('/', { replace: true });
        return;
      }

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