import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
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

    // Default: go home
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default AuthRedirect;
