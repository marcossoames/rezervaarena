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
import { X, Plus, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FacilityFormData {
  facilityName: string;
  description: string;
  facilityType: string;
  address: string;
  city: string;
  pricePerHour: number;
  capacity: number;
}

const AddFacilityPage = () => {
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/facility/login");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!profile || profile.role !== 'facility_owner') {
        toast({
          title: "Acces restricționat",
          description: "Doar proprietarii de baze sportive pot adăuga facilități",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      setUserProfile(profile);
    };

    checkAuth();
  }, []);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FacilityFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();

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
    if (!userProfile) return;

    setIsLoading(true);

    try {
      const { error: facilityError } = await supabase
        .from('facilities')
        .insert({
          owner_id: userProfile.user_id,
          name: data.facilityName,
          description: data.description,
          facility_type: data.facilityType as "tennis" | "football" | "padel" | "swimming" | "basketball" | "volleyball",
          address: data.address,
          city: data.city,
          price_per_hour: data.pricePerHour,
          capacity: data.capacity,
          amenities: amenities
        });

      if (facilityError) {
        console.error('Facility creation error:', facilityError);
        throw new Error(`Eroare la crearea facilității: ${facilityError.message}`);
      }

      toast({
        title: "Facilitate adăugată cu succes!",
        description: "Noua facilitate a fost adăugată în profilul tău."
      });

      navigate("/facilities");
    } catch (error: any) {
      console.error('Add facility error:', error);
      toast({
        title: "Eroare la adăugarea facilității",
        description: error.message || "A apărut o eroare neașteptată",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) {
    return <div>Se încarcă...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      {/* Back Button */}
      <div className="container mx-auto max-w-2xl mb-4">
        <Link to="/facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la facilități
        </Link>
      </div>
      
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-primary rounded-full"></div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Adaugă Facilitate Nouă
            </CardTitle>
            <CardDescription className="text-lg">
              Adaugă o nouă facilitate sportivă în baza ta
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="facilityName">Numele Facilității *</Label>
                  <Input
                    id="facilityName"
                    type="text"
                    {...register("facilityName", { required: "Numele facilității este obligatoriu" })}
                    className="bg-background/50"
                    placeholder="ex: Teren Tenis 1, Teren Fotbal Principal"
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
                    placeholder="Descrieți această facilitate specifică..."
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
                      placeholder="Adaugă facilitate (ex: vestiare, duș, parcare)"
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
                {isLoading ? "Se adaugă..." : "Adaugă Facilitatea"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddFacilityPage;