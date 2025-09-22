import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Mail, Lock, ArrowLeft, Phone, MapPin, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { processPendingImages } from "@/utils/pendingImagesHandler";

const SportsFacilityLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Eroare",
        description: "Te rog completează toate câmpurile",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Process pending images if any
        await processPendingImages();

        // Check if user has facilities (indicating they are a facility owner)
        const { data: facilities, error: facilityError } = await supabase
          .from('facilities')
          .select('id')
          .eq('owner_id', data.user.id)
          .limit(1);

        if (facilityError) {
          console.error('Error checking facilities:', facilityError);
        }

        if (facilities && facilities.length > 0) {
          // User has facilities, redirect to facility owner profile page
          navigate('/facility-owner-profile');
        } else {
          // User doesn't have facilities, check their profile for facility owner status
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_type_comment, role')
            .eq('user_id', data.user.id)
            .single();

          if (profile?.user_type_comment?.includes('Proprietar bază sportivă') || profile?.role === 'facility_owner') {
            // Allow access to dashboard; they can add facilities after login
            toast({
              title: "Autentificat cu succes",
              description: "Bun venit în profilul tău!",
            });
            navigate('/facility-owner-profile');
          } else {
            toast({
              title: "Acces restricționat", 
              description: "Acest cont nu este înregistrat ca proprietar de bază sportivă",
              variant: "destructive"
            });
            await supabase.auth.signOut();
          }
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      toast({
        title: "Eroare la autentificare",
        description: error.message || "Email sau parolă incorectă",
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
            Înapoi la RezervaArena
          </Link>
        </div>

        <Card className="shadow-elegant animate-scale-in">
          <CardHeader className="text-center pb-6">
            <div className="w-16 h-16 bg-gradient-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-accent-foreground" />
            </div>
            <CardTitle className="text-2xl text-foreground">Bază Sportivă</CardTitle>
            <p className="text-muted-foreground">Gestionează-ți facilitatea și rezervările</p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email bază sportivă</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="contact@bazasportiva.ro"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <Link to="/facility/register" className="text-primary hover:underline">
                  Înregistrează baza sportivă
                </Link>
                <Link to="/forgot-password" className="text-muted-foreground hover:text-primary transition-smooth">
                  Ai uitat parola?
                </Link>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg" 
                variant="sport"
                disabled={isLoading}
              >
                {isLoading ? "Se conectează..." : "Acces Dashboard"}
              </Button>
            </form>

            <div className="bg-secondary/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">Nou pe RezervaArena?</p>
              <Link to="/facility/register">
                <Button variant="outline" size="sm">
                  Înregistrează-ți baza sportivă
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SportsFacilityLogin;