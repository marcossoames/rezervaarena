import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  businessName: string;
  businessDescription: string;
  address: string;
  city: string;
  numberOfFacilities: number;
}

interface FacilityInfo {
  name: string;
  description: string;
  facilityType: string;
  pricePerHour: number;
  capacity: number;
  amenities: string[];
}

const FacilityRegister = () => {
  const [facilities, setFacilities] = useState<FacilityInfo[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [accountData, setAccountData] = useState<AccountFormData | null>(null);
  const [amenityInputs, setAmenityInputs] = useState<string[]>([]);

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<AccountFormData>();
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

  const addAmenityToFacility = (facilityIndex: number, amenity: string) => {
    if (!amenity.trim()) return;
    
    const updatedFacilities = [...facilities];
    if (!updatedFacilities[facilityIndex].amenities.includes(amenity.trim())) {
      updatedFacilities[facilityIndex].amenities.push(amenity.trim());
      setFacilities(updatedFacilities);
    }
    
    // Clear the input
    const newInputs = [...amenityInputs];
    newInputs[facilityIndex] = '';
    setAmenityInputs(newInputs);
  };

  const removeAmenityFromFacility = (facilityIndex: number, amenityToRemove: string) => {
    const updatedFacilities = [...facilities];
    updatedFacilities[facilityIndex].amenities = updatedFacilities[facilityIndex].amenities.filter(
      amenity => amenity !== amenityToRemove
    );
    setFacilities(updatedFacilities);
  };

  const updateFacilityField = (index: number, field: keyof FacilityInfo, value: any) => {
    const updatedFacilities = [...facilities];
    updatedFacilities[index] = { ...updatedFacilities[index], [field]: value };
    setFacilities(updatedFacilities);
  };

  const initializeFacilities = (count: number) => {
    const newFacilities: FacilityInfo[] = [];
    const newInputs: string[] = [];
    for (let i = 0; i < count; i++) {
      newFacilities.push({
        name: '',
        description: '',
        facilityType: '',
        pricePerHour: 0,
        capacity: 1,
        amenities: []
      });
      newInputs.push('');
    }
    setFacilities(newFacilities);
    setAmenityInputs(newInputs);
  };

  const handleStep1Submit = (data: AccountFormData) => {
    if (data.password !== data.confirmPassword) {
      toast({
        title: "Eroare",
        description: "Parolele nu se potrivesc",
        variant: "destructive"
      });
      return;
    }

    setAccountData(data);
    initializeFacilities(data.numberOfFacilities);
    setCurrentStep(2);
  };

  const validateFacilities = () => {
    for (let i = 0; i < facilities.length; i++) {
      const facility = facilities[i];
      if (!facility.name || !facility.facilityType || !facility.pricePerHour || !facility.capacity) {
        toast({
          title: "Facilitate incompletă",
          description: `Completează toate câmpurile pentru facilitatea ${i + 1}`,
          variant: "destructive"
        });
        return false;
      }
    }
    return true;
  };

  const handleFinalSubmit = async () => {
    if (!accountData || !validateFacilities()) return;

    setIsLoading(true);

    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: accountData.fullName,
            phone: accountData.phone,
            role: 'facility_owner'
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // Wait for user to be properly authenticated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update user role manually in profiles table
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role: 'facility_owner' })
          .eq('user_id', authData.user.id);
        
        if (roleError) {
          console.error('Role update error:', roleError);
          throw new Error('Eroare la actualizarea rolului utilizatorului');
        }
        
        // Update phone separately
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: accountData.phone })
          .eq('user_id', authData.user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
          throw new Error('Eroare la actualizarea profilului');
        }

        // Wait a bit more to ensure role is properly set
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create all facilities
        for (const facility of facilities) {
          const { error: facilityError } = await supabase
            .from('facilities')
            .insert({
              owner_id: authData.user.id,
              name: facility.name,
              description: facility.description,
              facility_type: facility.facilityType as "tennis" | "football" | "padel" | "swimming" | "basketball" | "volleyball",
              address: accountData.address,
              city: accountData.city,
              price_per_hour: facility.pricePerHour,
              capacity: facility.capacity,
              amenities: facility.amenities
            });

          if (facilityError) {
            console.error('Facility creation error:', facilityError);
            throw new Error(`Eroare la crearea facilității: ${facilityError.message}`);
          }
        }

        toast({
          title: "Cont creat cu succes!",
          description: `Ai adăugat ${facilities.length} facilități. Acum poți adăuga imagini pentru fiecare.`
        });

        // Redirect to manage facilities page where they can add images
        navigate("/manage-facilities");
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

  const renderStep1 = () => (
    <form onSubmit={handleSubmit(handleStep1Submit)} className="space-y-6">
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

      {/* Business Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Informații Bază Sportivă</h3>
        
        <div className="space-y-2">
          <Label htmlFor="businessName">Numele Bazei Sportive *</Label>
          <Input
            id="businessName"
            type="text"
            {...register("businessName", { required: "Numele bazei sportive este obligatoriu" })}
            className="bg-background/50"
            placeholder="ex: Complexul Sportiv Arena"
          />
          {errors.businessName && (
            <p className="text-sm text-destructive">{errors.businessName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessDescription">Descriere</Label>
          <Textarea
            id="businessDescription"
            {...register("businessDescription")}
            className="bg-background/50 min-h-[100px]"
            placeholder="Descrieți baza dumneavoastră sportivă..."
          />
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
            <Label htmlFor="numberOfFacilities">Numărul de terenuri *</Label>
            <Input
              id="numberOfFacilities"
              type="number"
              min="1"
              max="10"
              {...register("numberOfFacilities", { 
                required: "Numărul de terenuri este obligatoriu",
                valueAsNumber: true,
                min: {
                  value: 1,
                  message: "Trebuie să aveți cel puțin un teren"
                },
                max: {
                  value: 10,
                  message: "Maxim 10 terenuri"
                }
              })}
              className="bg-background/50"
              placeholder="ex: 3"
            />
            {errors.numberOfFacilities && (
              <p className="text-sm text-destructive">{errors.numberOfFacilities.message}</p>
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

        <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-sm text-muted-foreground mb-2">
            📋 <strong>Pas următor:</strong> Vei completa detaliile pentru fiecare teren în parte.
          </p>
          <p className="text-xs text-muted-foreground">
            Fiecare teren va avea propriile imagini, preț și facilități.
          </p>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        Continuă cu Facilitățile
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </form>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Detalii Facilități ({facilities.length} facilități)
        </h3>
        <Button 
          onClick={() => setCurrentStep(1)} 
          variant="outline" 
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Înapoi
        </Button>
      </div>

      {facilities.map((facility, index) => (
        <Card key={index} className="border-2">
          <CardHeader>
            <CardTitle className="text-lg">Facilitatea {index + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Numele Facilității *</Label>
                <Input
                  value={facility.name}
                  onChange={(e) => updateFacilityField(index, 'name', e.target.value)}
                  placeholder="ex: Teren Fotbal 1, Teren Tenis A"
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipul Facilității *</Label>
                <Select 
                  value={facility.facilityType} 
                  onValueChange={(value) => updateFacilityField(index, 'facilityType', value)}
                >
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
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descriere</Label>
              <Textarea
                value={facility.description}
                onChange={(e) => updateFacilityField(index, 'description', e.target.value)}
                placeholder="Descrieți această facilitate specifică..."
                className="bg-background/50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preț/Oră (RON) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={facility.pricePerHour || ''}
                  onChange={(e) => updateFacilityField(index, 'pricePerHour', parseFloat(e.target.value) || 0)}
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <Label>Capacitate *</Label>
                <Input
                  type="number"
                  min="1"
                  value={facility.capacity || ''}
                  onChange={(e) => updateFacilityField(index, 'capacity', parseInt(e.target.value) || 1)}
                  className="bg-background/50"
                />
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-2">
              <Label>Facilități & Servicii</Label>
              <div className="flex gap-2">
                <Input
                  value={amenityInputs[index] || ''}
                  onChange={(e) => {
                    const newInputs = [...amenityInputs];
                    newInputs[index] = e.target.value;
                    setAmenityInputs(newInputs);
                  }}
                  placeholder="Adaugă facilitate (ex: vestiare, duș)"
                  className="bg-background/50"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAmenityToFacility(index, amenityInputs[index] || '');
                    }
                  }}
                />
                <Button 
                  type="button" 
                  onClick={() => addAmenityToFacility(index, amenityInputs[index] || '')} 
                  size="icon" 
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {facility.amenities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {facility.amenities.map((amenity) => (
                    <Badge key={amenity} variant="secondary" className="flex items-center gap-1">
                      {amenity}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 hover:bg-transparent"
                        onClick={() => removeAmenityFromFacility(index, amenity)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/20">
        <p className="text-sm text-muted-foreground mb-2">
          📸 <strong>Pas final:</strong> După înregistrare, vei putea adăuga imagini pentru fiecare facilitate în parte.
        </p>
        <p className="text-xs text-muted-foreground">
          Fiecare facilitate poate avea până la 8 imagini și o imagine principală.
        </p>
      </div>

      <Button 
        onClick={handleFinalSubmit}
        className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
        disabled={isLoading}
      >
        {isLoading ? "Se procesează..." : "Finalizează Înregistrarea"}
      </Button>
    </div>
  );

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
              {currentStep === 1 
                ? "Creează contul și adaugă informațiile despre baza ta sportivă"
                : "Completează detaliile pentru fiecare facilitate"
              }
            </CardDescription>
            
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`w-8 h-1 ${currentStep >= 2 ? 'bg-primary' : 'bg-muted'}`}></div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                2
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {currentStep === 1 ? renderStep1() : renderStep2()}
          </CardContent>

          <div className="text-center pb-6">
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
        </Card>
      </div>
    </div>
  );
};

export default FacilityRegister;