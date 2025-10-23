import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setIsValidToken(true);
          try {
            const cleanUrl = window.location.origin + "/reset-password";
            window.history.replaceState({}, document.title, cleanUrl);
          } catch {}
          return;
        }

        const fromQuery = new URLSearchParams(window.location.search);
        const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = fromQuery.get("access_token") || fromHash.get("access_token");
        const refreshToken = fromQuery.get("refresh_token") || fromHash.get("refresh_token");

        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          setIsValidToken(true);
          try {
            const cleanUrl = window.location.origin + "/reset-password";
            window.history.replaceState({}, document.title, cleanUrl);
          } catch {}
          return;
        }

        // Fallback: support links that provide a one-time 'code' or 'token_hash'
        const code =
          fromQuery.get("code") ||
          fromHash.get("code") ||
          fromQuery.get("token") ||
          fromHash.get("token") ||
          fromQuery.get("token_hash") ||
          fromHash.get("token_hash");

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session) {
            setIsValidToken(true);
            try {
              const cleanUrl = window.location.origin + "/reset-password";
              window.history.replaceState({}, document.title, cleanUrl);
            } catch {}
            return;
          }
        }

        toast({
          title: "Link invalid",
          description: "Link-ul de resetare a parolei este invalid sau a expirat.",
          variant: "destructive",
        });
        navigate("/forgot-password");
      } catch {
        toast({
          title: "Eroare",
          description: "Nu am putut valida link-ul. Încercați din nou.",
          variant: "destructive",
        });
        navigate("/forgot-password");
      }
    };
    void init();
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast({
        title: "Eroare",
        description: "Vă rugăm să introduceți noua parolă.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Eroare",
        description: "Parola trebuie să aibă cel puțin 6 caractere.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Eroare",
        description: "Parolele nu se potrivesc.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast({
          title: "Eroare",
          description: "Nu am putut reseta parola. Încercați din nou.",
          variant: "destructive",
        });
      } else {
        setPasswordReset(true);
        toast({
          title: "Succes!",
          description: "Parola a fost resetată cu succes.",
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

  if (!isValidToken) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-4 overflow-auto">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Se verifică link-ul...</CardTitle>
            <CardDescription>
              Vă rugăm să așteptați
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (passwordReset) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-4 overflow-auto">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>Parola resetată cu succes!</CardTitle>
            <CardDescription>
              Acum vă puteți autentifica cu noua parolă
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/client/login")}
              className="w-full"
            >
              Mergi la autentificare
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/10 pt-[calc(env(safe-area-inset-top)+1rem)] px-4 pb-4 overflow-auto">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Resetare parolă</CardTitle>
          <CardDescription>
            Introduceți noua parolă pentru contul dumneavoastră
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Parola nouă</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Introduceți parola nouă"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmă parola</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirmați parola nouă"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Se resetează...
                </>
              ) : (
                "Resetează parola"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;