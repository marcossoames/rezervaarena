import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "Eroare",
        description: "Vă rugăm să introduceți adresa de email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const baseUrl = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/reset-password`,
      });

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu am putut trimite email-ul de resetare. Verificați adresa de email.",
          variant: "destructive",
        });
      } else {
        setEmailSent(true);
        toast({
          title: "Email trimis!",
          description: "Verificați-vă inbox-ul pentru link-ul de resetare a parolei.",
        });
      }
    } catch (error) {
      toast({
        title: "Eroare",
        description: "A apărut o eroare neașteptată. Încercați din nou.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Email trimis cu succes!</CardTitle>
            <CardDescription>
              Am trimis un link de resetare a parolei la adresa {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground text-center">
              Verificați-vă inbox-ul și urmați instrucțiunile pentru a vă reseta parola.
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full"
              >
                Trimite din nou
              </Button>
              <Button 
                onClick={() => navigate("/")}
                className="w-full"
              >
                Înapoi la pagina principală
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)}
              className="w-8 h-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>Resetare parolă</CardTitle>
          </div>
          <CardDescription>
            Introduceți adresa de email pentru a primi un link de resetare a parolei
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresa de email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nume@exemplu.ro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se trimite...
                </>
              ) : (
                "Trimite link de resetare"
              )}
            </Button>
            
            <div className="text-center">
              <Link 
                to="/client/login" 
                className="text-sm text-primary hover:underline"
              >
                Înapoi la autentificare
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPasswordPage;