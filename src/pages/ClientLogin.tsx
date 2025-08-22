import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LoginFormData {
  email: string;
  password: string;
}

const ClientLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setShowEmailConfirmation(false);

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Check if it's an email confirmation error
        if (error.message.includes('email not confirmed') || error.message.includes('Email not confirmed')) {
          setShowEmailConfirmation(true);
          toast({
            title: "Email neconfirmat",
            description: "Te rugăm să-ți confirmi adresa de email înainte să te conectezi.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Eroare la autentificare",
            description: error.message || "Credențiale incorecte",
            variant: "destructive"
          });
        }
        return;
      }

      if (authData.user) {
        toast({
          title: "Conectare reușită!",
          description: "Te-ai conectat cu succes."
        });
        navigate("/");
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la conectare",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resendConfirmation = async () => {
    const email = (document.getElementById('email') as HTMLInputElement)?.value;
    
    if (!email) {
      toast({
        title: "Eroare",
        description: "Te rugăm să introduci adresa de email",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Email retrimis!",
        description: "Verifică-ți din nou emailul pentru confirmarea contului."
      });
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message || "Nu s-a putut retrimite emailul de confirmare",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center text-primary-foreground hover:text-primary-foreground/80 transition-smooth">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Înapoi la SportBook
          </Link>
        </div>

        <Card className="shadow-elegant animate-scale-in">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-accent-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Autentificare Client</CardTitle>
            <p className="text-muted-foreground">Conectează-te pentru a rezerva terenuri</p>
          </CardHeader>

          <CardContent className="space-y-6">
            {showEmailConfirmation && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Contul tău nu este confirmat. Verifică-ți emailul și dă click pe linkul de confirmare.
                  <Button
                    variant="link"
                    className="p-0 h-auto font-normal ml-1"
                    onClick={resendConfirmation}
                  >
                    Retrimite emailul de confirmare
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresa de email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="nume@email.com"
                    className="pl-10"
                    {...register("email", { 
                      required: "Emailul este obligatoriu",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Adresa de email nu este validă"
                      }
                    })}
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Parola</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="Parola ta"
                    className="pl-10"
                    {...register("password", { 
                      required: "Parola este obligatorie"
                    })}
                  />
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link to="/client/register" className="text-primary hover:underline">
                  Creează cont nou
                </Link>
                <Link to="/forgot-password" className="text-muted-foreground hover:text-primary transition-smooth">
                  Ai uitat parola?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? "Se conectează..." : "Conectează-te"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">sau</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" asChild>
              <Link to="/">Continuă ca vizitator</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientLogin;