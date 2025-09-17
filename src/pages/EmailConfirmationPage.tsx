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
        // Preferă parametrii din URL pentru statusul confirmării
        const { hash, search } = window.location;
        const combined = new URLSearchParams(
          (search?.startsWith('?') ? search : `?${search || ''}`) +
          (hash ? `&${hash.replace(/^#/, '')}` : '')
        );
        const type = combined.get('type');
        const errorCode = combined.get('error_code') || combined.get('error');

        if (type === 'signup' && !errorCode) {
          setStatus('success');
          toast({
            title: "Email confirmat cu succes!",
            description: "Contul tău a fost activat. Acum te poți conecta.",
          });
          return;
        }

        // Fallback: verificăm user-ul curent
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email_confirmed_at) {
          setStatus('success');
          toast({
            title: "Email confirmat cu succes!",
            description: "Contul tău a fost activat. Acum te poți conecta.",
          });
          return;
        }

        if (errorCode) {
          setStatus('error');
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
  }, [toast]);

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