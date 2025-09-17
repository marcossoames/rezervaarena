import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const type = searchParams.get('type');
        const errorCode = searchParams.get('error_code') || searchParams.get('error');
        
        if (type === 'signup' && accessToken && refreshToken && !errorCode) {
          // Set the session using the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) throw error;

          if (data.user) {
            setStatus('success');
            
            // Check if this is a facility owner
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_type_comment, full_name')
              .eq('user_id', data.user.id)
              .single();

            if (profile?.user_type_comment?.includes('Proprietar bază sportivă')) {
              // Check if they already have facilities
              const { data: facilities } = await supabase
                .from('facilities')
                .select('id')
                .eq('owner_id', data.user.id)
                .limit(1);

              if (!facilities || facilities.length === 0) {
                // Check for saved registration data
                const savedData = sessionStorage.getItem('facilityRegistrationData');
                if (savedData) {
                  toast({
                    title: "Email confirmat cu succes!",
                    description: "Completând înregistrarea cu facilitățile salvate...",
                  });
                  // Redirect will be handled by FacilityRegister page
                  setTimeout(() => {
                    navigate('/facility/register?step=2');
                  }, 1500);
                  return;
                } else {
                  // No saved data - redirect to complete registration
                  toast({
                    title: "Email confirmat cu succes!",
                    description: "Acum completează informațiile despre facilitățile tale",
                  });
                  setTimeout(() => {
                    navigate('/facility/register?step=2');
                  }, 2000);
                  return;
                }
              } else {
                // Facility owner with facilities - redirect to dashboard
                toast({
                  title: "Email confirmat cu succes!",
                  description: "Contul tău a fost activat.",
                });
                setTimeout(() => {
                  navigate('/manage-facilities');
                }, 2000);
                return;
              }
            } else {
              // Regular client
              toast({
                title: "Email confirmat cu succes!",
                description: "Contul tău a fost activat. Acum te poți conecta.",
              });
              return;
            }
          }
        }

        if (errorCode) {
          setStatus('error');
          return;
        }

        // Fallback: verificăm user-ul curent
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          setStatus('success');
          
          // Check if this is a facility owner who needs to complete registration
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type_comment')
            .eq('user_id', user.id)
            .single();

          if (profile?.user_type_comment?.includes('Proprietar bază sportivă')) {
            const { data: facilities } = await supabase
              .from('facilities')
              .select('id')
              .eq('owner_id', user.id)
              .limit(1);

            if (!facilities || facilities.length === 0) {
              toast({
                title: "Email confirmat cu succes!",
                description: "Acum completează informațiile despre facilitățile tale",
              });
              setTimeout(() => {
                navigate('/facility/register?step=2');
              }, 2000);
              return;
            }
          }
          
          toast({
            title: "Email confirmat cu succes!",
            description: "Contul tău a fost activat. Acum te poți conecta.",
          });
          return;
        }

        // Mai așteptăm puțin și re-verificăm
        setTimeout(async () => {
          const { data: { user: updatedUser } } = await supabase.auth.getUser();
          if (updatedUser?.email_confirmed_at) {
            setStatus('success');
            toast({
              title: "Email confirmat cu succes!",
              description: "Contul tău a fost activat. Acum te poți conecta.",
            });
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