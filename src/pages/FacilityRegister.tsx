import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FacilityFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  facilityName: string;
  description: string;
  facilityType: string;
  address: string;
  city: string;
  pricePerHour: number;
  capacity: number;
}

const FacilityRegister = () => {
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FacilityFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const password = watch("password");

  const facilityTypes = [
    { value: "tennis", label: "Tenis" },
    { value: "football", label: "Fotbal" },
    { value: "padel", label: "Padel" },
    { value: "swimming", label: "Înot" },
    { value: "basketball", label: "Baschet" },
    { value: "volleyball", label: "Volei" }
  ];

  const addAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity("");
    }
  };

  const removeAmenity = (amenity: string) => {
    setAmenities(amenities.filter(a => a !== amenity));
  };

  const onSubmit = async (data: FacilityFormData) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: "Eroare",
        description: "Parolele nu se potrivesc",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.fullName,
            phone: data.phone,
            role: 'facility_owner'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with facility owner role
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: 'facility_owner',
            phone: data.phone
          })
          .eq('user_id', authData.user.id);

        if (profileError) throw profileError;

        // Create the facility
        const { error: facilityError } = await supabase
          .from('facilities')
          .insert({
            owner_id: authData.user.id,
            name: data.facilityName,
            description: data.description,
            facility_type: data.facilityType as "tennis" | "football" | "padel" | "swimming" | "basketball" | "volleyball",
            address: data.address,
            city: data.city,
            price_per_hour: data.pricePerHour,
            capacity: data.capacity,
            amenities: amenities
          });

        if (facilityError) throw facilityError;

        toast({
          title: "Cont creat cu succes!",
          description: "Verifică-ți emailul pentru a confirma contul."
        });

        navigate("/facility/login");
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      toast({
        title: "Eroare la înregistrare",
        description: error.message || "A apărut o eroare neașteptată",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      {/* Back Button */}
      <div className="container mx-auto max-w-2xl mb-4">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la pagina principală
        </Link>
      </div>
      
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <div className="w-8 h-8 bg-primary rounded-full"></div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Înregistrare Bază Sportivă
          </CardTitle>
          <CardDescription className="text-lg">
            Creează contul pentru baza ta sportivă și începe să primești rezervări
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Informații Cont</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nume Complet *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    {...register("fullName", { required: "Numele este obligatoriu" })}
                    className="bg-background/50"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-destructive">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...register("phone")}
                    className="bg-background/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email", { 
                    required: "Emailul este obligatoriu",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Email invalid"
                    }
                  })}
                  className="bg-background/50"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Parolă *</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register("password", { 
                      required: "Parola este obligatorie",
                      minLength: {
                        value: 6,
                        message: "Parola trebuie să aibă cel puțin 6 caractere"
                      }
                    })}
                    className="bg-background/50"
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmă Parola *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    {...register("confirmPassword", { 
                      required: "Confirmarea parolei este obligatorie",
                      validate: value => value === password || "Parolele nu se potrivesc"
                    })}
                    className="bg-background/50"
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Facility Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Informații Bază Sportivă</h3>
              
              <div className="space-y-2">
                <Label htmlFor="facilityName">Numele Bazei Sportive *</Label>
                <Input
                  id="facilityName"
                  type="text"
                  {...register("facilityName", { required: "Numele bazei sportive este obligatoriu" })}
                  className="bg-background/50"
                />
                {errors.facilityName && (
                  <p className="text-sm text-destructive">{errors.facilityName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descriere</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  className="bg-background/50 min-h-[100px]"
                  placeholder="Descrieți baza dumneavoastră sportivă..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipul Facilității *</Label>
                  <Select onValueChange={(value) => setValue("facilityType", value)}>
                    <SelectTrigger className="bg-background/50">
                      <SelectValue placeholder="Selectează tipul" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilityTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    {...register("facilityType", { required: "Tipul facilității este obligatoriu" })}
                  />
                  {errors.facilityType && (
                    <p className="text-sm text-destructive">{errors.facilityType.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacitate *</Label>
                  <Input
                    id="capacity"
                    type="number"
                    min="1"
                    {...register("capacity", { 
                      required: "Capacitatea este obligatorie",
                      valueAsNumber: true,
                      min: {
                        value: 1,
                        message: "Capacitatea trebuie să fie cel puțin 1"
                      }
                    })}
                    className="bg-background/50"
                  />
                  {errors.capacity && (
                    <p className="text-sm text-destructive">{errors.capacity.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Oraș *</Label>
                  <Input
                    id="city"
                    type="text"
                    {...register("city", { required: "Orașul este obligatoriu" })}
                    className="bg-background/50"
                  />
                  {errors.city && (
                    <p className="text-sm text-destructive">{errors.city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricePerHour">Preț/Oră (RON) *</Label>
                  <Input
                    id="pricePerHour"
                    type="number"
                    min="1"
                    step="0.01"
                    {...register("pricePerHour", { 
                      required: "Prețul este obligatoriu",
                      valueAsNumber: true,
                      min: {
                        value: 1,
                        message: "Prețul trebuie să fie cel puțin 1 RON"
                      }
                    })}
                    className="bg-background/50"
                  />
                  {errors.pricePerHour && (
                    <p className="text-sm text-destructive">{errors.pricePerHour.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresa Completă *</Label>
                <Input
                  id="address"
                  type="text"
                  {...register("address", { required: "Adresa este obligatorie" })}
                  className="bg-background/50"
                  placeholder="Strada, numărul, sectorul/comuna"
                />
                {errors.address && (
                  <p className="text-sm text-destructive">{errors.address.message}</p>
                )}
              </div>

              {/* Amenities */}
              <div className="space-y-2">
                <Label>Facilități & Servicii</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Adaugă facilitate (ex: parcare, vestiare)"
                    className="bg-background/50"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                  />
                  <Button type="button" onClick={addAmenity} size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {amenities.map((amenity) => (
                      <Badge key={amenity} variant="secondary" className="flex items-center gap-1">
                        {amenity}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 hover:bg-transparent"
                          onClick={() => removeAmenity(amenity)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? "Se procesează..." : "Înregistrează Baza Sportivă"}
            </Button>
          </form>

          <div className="text-center">
            <p className="text-muted-foreground">
              Ai deja un cont?{" "}
              <Link 
                to="/facility/login" 
                className="text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                Conectează-te aici
              </Link>
            </p>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FacilityRegister;