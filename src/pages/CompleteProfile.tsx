import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validatePhone } from "@/utils/inputValidation";

interface CompleteProfileFormData {
  full_name: string;
  phone: string;
}

const CompleteProfile = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [acceptGdpr, setAcceptGdpr] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<CompleteProfileFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/client-login', { replace: true });
        return;
      }

      setUserEmail(session.user.email || "");
      
      // Pre-fill name from Google metadata
      const fullName = session.user.user_metadata?.full_name || 
                       session.user.user_metadata?.name || 
                       "";
      setValue("full_name", fullName);

      // Check if profile already exists and is complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // If profile exists and has a valid phone number (not empty, not placeholder), redirect to home
      const hasValidPhone = profile?.phone && 
                           profile.phone !== 'Telefon necompletat' && 
                           profile.phone.trim() !== '';
      
      if (hasValidPhone) {
        console.log('Profile already complete, redirecting to home');
        navigate('/', { replace: true });
      }
    };

    loadUserData();
  }, [navigate, setValue]);

  const onSubmit = async (data: CompleteProfileFormData) => {
    setIsLoading(true);

    try {
      // Validate GDPR acceptance
      if (!acceptGdpr) {
        toast({
          title: "Politica de confidențialitate",
          description: "Trebuie să accepți Politica de confidențialitate pentru a continua",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Validate phone
      const phoneValidation = validatePhone(data.phone);
      if (!phoneValidation.isValid) {
        toast({
          title: "Eroare la validare",
          description: phoneValidation.error,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        toast({
          title: "Eroare",
          description: "Nu ești autentificat",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Update or insert profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          user_id: session.user.id,
          email: session.user.email!,
          full_name: data.full_name,
          phone: data.phone,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (profileError) {
        toast({
          title: "Eroare la salvare",
          description: profileError.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: "Profil completat cu succes!",
        description: "Bun venit pe RezervaArena!"
      });

      navigate('/', { replace: true });
    } catch (error: any) {
      toast({
        title: "Eroare",
        description: error.message || "A apărut o eroare la completarea profilului",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4 overflow-auto">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-primary/10">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Completează Profilul
            </CardTitle>
            <CardDescription className="text-base">
              Mai avem nevoie de câteva informații pentru a-ți finaliza contul
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    disabled
                    className="pl-10 bg-muted cursor-not-allowed"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email-ul provine din contul tău Google și nu poate fi modificat
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_name">Nume Complet *</Label>
                <div className="relative">
                  <Input
                    id="full_name"
                    type="text"
                    placeholder="Ionescu Maria"
                    className="pl-10"
                    {...register("full_name", {
                      required: "Numele complet este obligatoriu",
                      minLength: {
                        value: 3,
                        message: "Numele trebuie să conțină cel puțin 3 caractere"
                      }
                    })}
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {errors.full_name && (
                  <p className="text-sm text-destructive">{errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Număr de Telefon *</Label>
                <div className="relative">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0712345678 sau +40712345678"
                    className="pl-10"
                    {...register("phone", {
                      required: "Numărul de telefon este obligatoriu"
                    })}
                  />
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Format: 0712345678 sau +40712345678
                </p>
              </div>

              <div className="flex items-start space-x-2 pb-4">
                <Checkbox 
                  id="gdpr" 
                  checked={acceptGdpr}
                  onCheckedChange={(checked) => setAcceptGdpr(checked as boolean)}
                />
                <label
                  htmlFor="gdpr"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  Am citit și sunt de acord cu{" "}
                  <Link 
                    to="/privacy-policy" 
                    target="_blank"
                    className="text-primary hover:underline font-medium"
                  >
                    Politica de confidențialitate (GDPR)
                  </Link>
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate('/', { replace: true });
                  }}
                >
                  Anulează
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  size="lg"
                  disabled={isLoading || !acceptGdpr}
                >
                  {isLoading ? "Se salvează..." : "Finalizează Înregistrarea"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompleteProfile;
