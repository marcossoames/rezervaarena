import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Lock, ArrowLeft, AlertCircle, Eye, EyeOff } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmailVerificationDialog } from "@/components/EmailVerificationDialog";
import { translateError } from "@/utils/errorTranslations";
import { useBodyClass } from "@/hooks/useBodyClass";
import { signInWithGoogle } from "@/utils/googleAuth";

interface LoginFormData {
  email: string;
  password: string;
}

const ClientLogin = () => {
  useBodyClass('bg-gradient-hero');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showEmailVerificationDialog, setShowEmailVerificationDialog] = useState(false);
  const [userEmailForVerification, setUserEmailForVerification] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
          setUserEmailForVerification(data.email);
          setShowEmailVerificationDialog(true);
        } else {
          toast({
            title: "Eroare la autentificare",
            description: translateError(error.message) || "Credențiale incorecte",
            variant: "destructive"
          });
        }
        return;
      }

      if (authData.user) {
        // Check user role to redirect appropriately
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authData.user.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type_comment')
          .eq('user_id', authData.user.id)
          .single();

        const { data: facilities } = await supabase
          .from('facilities')
          .select('id')
          .eq('owner_id', authData.user.id)
          .limit(1);

        // Determine if user is a facility owner
        const isFacilityOwner = 
          userRoles?.some(ur => ur.role === 'facility_owner') ||
          profile?.user_type_comment?.includes('Proprietar bază sportivă') ||
          (facilities && facilities.length > 0);

        const isAdmin = userRoles?.some(ur => ur.role === 'admin' || ur.role === 'super_admin');

        if (isFacilityOwner) {
          toast({
            title: "Acces restricționat",
            description: "Proprietarii de baze sportive trebuie să se autentifice prin pagina dedicată.",
            variant: "destructive"
          });
          await supabase.auth.signOut();
          setTimeout(() => {
            navigate('/facility/login');
          }, 1500);
          return;
        }

        if (isAdmin) {
          toast({
            title: "Acces restricționat",
            description: "Administratorii trebuie să se autentifice prin pagina de admin.",
            variant: "destructive"
          });
          await supabase.auth.signOut();
          setTimeout(() => {
            navigate('/admin/login');
          }, 1500);
          return;
        }

        // Regular client login
        toast({
          title: "Conectare reușită!",
          description: "Te-ai conectat cu succes."
        });
        
        // Check if there's a redirect location stored
        const redirectPath = sessionStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
        } else {
          navigate("/");
        }
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

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      
      // Preserve redirect path for OAuth flow
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      
      // Use unified Google sign-in (works on both web and mobile)
      const { data, error } = await signInWithGoogle();

      if (error) {
        toast({
          title: "Eroare la autentificare",
          description: translateError(error),
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      // For web OAuth, the page will redirect, so we don't set loading to false
      // For native, we need to check the user and redirect
      if (data?.user) {
        // Native flow - user is authenticated immediately
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);

        const isFacilityOwner = userRoles?.some(ur => ur.role === 'facility_owner');
        const isAdmin = userRoles?.some(ur => ur.role === 'admin' || ur.role === 'super_admin');

        if (isFacilityOwner) {
          toast({
            title: "Acces restricționat",
            description: "Proprietarii de baze sportive trebuie să se autentifice prin pagina dedicată.",
            variant: "destructive"
          });
          await supabase.auth.signOut();
          navigate('/facility/login');
          return;
        }

        if (isAdmin) {
          toast({
            title: "Acces restricționat",
            description: "Administratorii trebuie să se autentifice prin pagina de admin.",
            variant: "destructive"
          });
          await supabase.auth.signOut();
          navigate('/admin/login');
          return;
        }

        toast({
          title: "Conectare reușită!",
          description: "Te-ai conectat cu succes."
        });
        
        if (redirectPath) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectPath);
        } else {
          navigate("/");
        }
      }
      
      // Note: redirectAfterLogin will be preserved in sessionStorage through the OAuth flow
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: "A apărut o eroare la conectarea cu Google",
        variant: "destructive"
      });
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
          emailRedirectTo: `${window.location.origin}/email-confirmation`
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
        description: translateError(error.message) || "Nu s-a putut retrimite emailul de confirmare",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <EmailVerificationDialog
        isOpen={showEmailVerificationDialog}
        onClose={() => setShowEmailVerificationDialog(false)}
        email={userEmailForVerification}
      />
      
      <div className="h-screen bg-gradient-hero flex items-center justify-center pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-4 overflow-auto">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center text-primary-foreground hover:text-primary-foreground/80 hover:border-primary-foreground border border-transparent rounded-md px-2 py-1 transition-smooth">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Înapoi la RezervaArena
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
                    type={showPassword ? "text" : "password"}
                    placeholder="Parola ta"
                    className="pl-10 pr-10"
                    {...register("password", { 
                      required: "Parola este obligatorie"
                    })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link 
                  to="/client/register" 
                  onClick={() => {
                    // Preserve redirect path when going to register
                    const currentRedirect = sessionStorage.getItem('redirectAfterLogin');
                    if (currentRedirect) {
                      sessionStorage.setItem('redirectAfterLogin', currentRedirect);
                    }
                  }}
                  className="text-primary hover:underline"
                >
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
                {isLoading ? "Se conectează..." : "Conectare"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">sau</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleGoogleLogin}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              Continuă cu Google
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default ClientLogin;