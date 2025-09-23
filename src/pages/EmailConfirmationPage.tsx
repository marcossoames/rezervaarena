import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { processPendingImages } from "@/utils/pendingImagesHandler";

const EmailConfirmationPage = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const registrationFlow = sessionStorage.getItem('registrationFlow');
  const loginRoute = registrationFlow === 'facility' ? '/facility/login' : '/client/login';

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check URL parameters for confirmation
        // Check URL parameters for confirmation (support both query and hash)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = searchParams.get('access_token') || hashParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token') || hashParams.get('refresh_token');
        const type = searchParams.get('type') || hashParams.get('type');
        const errorCode = searchParams.get('error_code') || searchParams.get('error') || hashParams.get('error_code') || hashParams.get('error');
        
        // Support both 'code' (PKCE) and access/refresh tokens in URL
        const code = searchParams.get('code') || hashParams.get('code') || searchParams.get('token_hash') || hashParams.get('token_hash');

        if (!errorCode && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (data?.user) {
            setStatus('success');
            try { window.history.replaceState({}, document.title, window.location.origin + '/email-confirmation'); } catch {}
            
            // Process pending images if any
            const imagesProcessed = await processPendingImages();
            if (imagesProcessed) {
              console.log('Pending images processed successfully');
            }
            
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_type_comment, full_name')
              .eq('user_id', data.user.id)
              .single();
            toast({ title: 'Email confirmat cu succes!', description: 'Contul tău a fost activat cu succes. Te poți conecta pe site pentru a avea acces la cont.' });
            
            // Redirect to appropriate dashboard after 2 seconds
            setTimeout(() => {
              const isOwner = profile?.user_type_comment === 'facility_owner';
              navigate(isOwner ? '/manage-facilities' : '/');
            }, 2000);
            return;
          }
        } else if (type === 'signup' && accessToken && refreshToken && !errorCode) {
          // Set the session using the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) throw error;

          if (data.user) {
            setStatus('success');
            try { window.history.replaceState({}, document.title, window.location.origin + '/email-confirmation'); } catch {}
            
            // Process pending images if any
            const imagesProcessed = await processPendingImages();
            if (imagesProcessed) {
              console.log('Pending images processed successfully');
            }
            
            // Check if this is a facility owner
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_type_comment, full_name')
              .eq('user_id', data.user.id)
              .single();

            toast({
              title: "Email confirmat cu succes!",
              description: "Contul tău a fost activat cu succes. Te poți conecta pe site pentru a avea acces la cont.",
            });
            
            // Redirect to appropriate dashboard after 2 seconds
            setTimeout(() => {
              const isOwner = profile?.user_type_comment === 'facility_owner';
              navigate(isOwner ? '/manage-facilities' : '/');
            }, 2000);
            return;
          }
        }

        // Removed localStorage/sign-in approach
        if (errorCode) {
          setStatus('error');
          return;
        }

        // Fallback: verificăm user-ul curent
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          setStatus('success');
          
          // Process pending images if any
          const imagesProcessed = await processPendingImages();
          if (imagesProcessed) {
            console.log('Pending images processed successfully');
          }
          
          // Check if this is a facility owner
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type_comment')
            .eq('user_id', user.id)
            .single();

          toast({
            title: "Email confirmat cu succes!",
            description: "Contul tău a fost activat cu succes. Te poți conecta pe site pentru a avea acces la cont.",
          });
          
          // Redirect to appropriate dashboard after 2 seconds
          setTimeout(() => {
            const isOwner = profile?.user_type_comment === 'facility_owner';
            navigate(isOwner ? '/manage-facilities' : '/');
          }, 2000);
          return;
        }

        // Mai așteptăm puțin și re-verificăm
        setTimeout(async () => {
          const { data: { user: updatedUser } } = await supabase.auth.getUser();
        if (updatedUser?.email_confirmed_at) {
            setStatus('success');
            
            // Process pending images if any
            const imagesProcessed = await processPendingImages();
            if (imagesProcessed) {
              console.log('Pending images processed successfully');
            }
            
            toast({
              title: "Email confirmat cu succes!",
              description: "Contul tău a fost activat cu succes. Te poți conecta pe site pentru a avea acces la cont.",
            });
            
            // Get user profile and redirect
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_type_comment')
              .eq('user_id', updatedUser.id)
              .single();
              
            setTimeout(() => {
              const isOwner = profile?.user_type_comment === 'facility_owner';
              navigate(isOwner ? '/manage-facilities' : '/');
            }, 2000);
          } else {
            setStatus('error');
          }
        }, 1500);
      } catch (error) {
        console.error('Email confirmation error:', error);
        setStatus('error');
        toast({
          title: "Eroare la confirmarea emailului",
          description: "A apărut o problemă la confirmarea emailului. Te rugăm să încerci din nou.",
          variant: "destructive"
        });
      }
    };

    handleEmailConfirmation();
  }, [searchParams, navigate, toast]);

  const handleGoToLogin = () => {
    navigate(loginRoute);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'loading' && (
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-16 w-16 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'loading' && "Confirmăm emailul..."}
            {status === 'success' && "Email confirmat!"}
            {status === 'error' && "Eroare la confirmare"}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && "Te rugăm să aștepți în timp ce confirmăm emailul tău."}
            {status === 'success' && "Contul tău a fost activat cu succes. Acum te poți conecta și gestiona facilitățile tale."}
            {status === 'error' && "Nu am putut confirma emailul tău. Te rugăm să încerci din nou sau să contactezi suportul."}
          </CardDescription>
        </CardHeader>
        
        {status !== 'loading' && (
          <CardContent className="space-y-3">
            {status === 'success' && (
              <Button 
                onClick={handleGoToLogin} 
                className="w-full"
                size="lg"
              >
                Intră în Cont
              </Button>
            )}
            
            <Button 
              onClick={handleGoHome} 
              variant="outline" 
              className="w-full"
              size="lg"
            >
              Înapoi la Pagina Principală
            </Button>
            
            {status === 'error' && (
              <Button 
                onClick={handleGoToLogin} 
                variant="outline" 
                className="w-full"
                size="lg"
              >
                Încearcă să te Conectezi
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default EmailConfirmationPage;