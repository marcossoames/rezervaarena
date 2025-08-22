import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Mail, Lock, ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cleanupAuthState } from "@/utils/authCleanup";
import { useToast } from "@/hooks/use-toast";


interface AdminLoginData {
  email: string;
  password: string;
}

const AdminLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<AdminLoginData>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const onSubmit = async (data: AdminLoginData) => {
    setIsLoading(true);

    try {
      // Sign in with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password
      });

      if (authError) {
        throw authError;
      }

      if (authData.user) {
        // Check if user has admin role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', authData.user.id)
          .single();

        if (profileError) {
          throw new Error('Nu s-a putut verifica rolul utilizatorului');
        }

        if (profile?.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error('Acces interzis. Doar administratorii pot accesa această secțiune.');
        }

        toast({
          title: "Autentificare reușită!",
          description: "Bun venit în panoul de administrare.",
        });

        // Redirect to admin dashboard (we'll create this later)
        navigate('/admin/dashboard');
      }
    } catch (error: any) {
      console.error('Error during admin login:', error);
      
      toast({
        title: "Eroare la autentificare",
        description: error.message || "Credențiale invalide sau eroare de sistem",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
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

        <Card className="shadow-elegant animate-scale-in border-sport-blue/30">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-sport-blue rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Panou Administrare</CardTitle>
            <p className="text-muted-foreground">Acces restricționat pentru administratori</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Zonă Securizată</p>
                <p className="text-xs text-destructive/80">Doar personalul autorizat poate accesa această secțiune</p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email administrator</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="admin-email" 
                    type="email" 
                    placeholder="admin@sportbook.ro"
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
                <Label htmlFor="admin-password">Parola administrator</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="admin-password" 
                    type="password" 
                    placeholder="Parola securizată"
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


              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                variant="premium"
                disabled={isLoading}
              >
                <Shield className="h-4 w-4 mr-2" />
                {isLoading ? "Se autentifică..." : "Acces Administrator"}
              </Button>
            </form>

          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;