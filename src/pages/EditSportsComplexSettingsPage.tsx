import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
interface FormData {
  sportsComplexName: string;
  address: string;
  city: string;
  phone: string;
  description: string;
  generalServices: string[];
  isActive: boolean;
  promotionOnly: boolean;
}
const EditSportsComplexSettingsPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [newService, setNewService] = useState("");
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: {
      errors
    }
  } = useForm<FormData>();
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const generalServices = watch("generalServices") || [];
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) {
          navigate("/facility/login");
          return;
        }
        

        // Get user profile
        const {
          data: profile,
          error: profileError
        } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
        
        if (profileError) {
          console.error('Profile error:', profileError);
          throw profileError;
        }
        const isAdmin = profile && profile.role === 'admin';
        const isFacilityOwner = profile && (profile.role === 'facility_owner' || profile.user_type_comment && profile.user_type_comment.includes('Proprietar bază sportivă'));
        if (!profile || !isAdmin && !isFacilityOwner) {
          toast({
            title: "Acces restricționat",
            description: "Doar proprietarii de baze sportive pot edita setările",
            variant: "destructive"
          });
          navigate("/");
          return;
        }

        // If admin, redirect to admin panel
        if (isAdmin) {
          toast({
            title: "Acces Admin",
            description: "Administratorii gestionează bazele sportive din panoul de administrare",
            variant: "default"
          });
          navigate("/admin/dashboard");
          return;
        }
        setUserProfile(profile);

        // Extract sports complex name from user_type_comment
        let sportsComplexName = profile.full_name || "";
        if (profile.user_type_comment) {
          // Remove system registration text
          let cleanName = profile.user_type_comment.replace(' - înregistrat prin sistem', '').replace(' - Proprietar bază sportivă', '').replace('Proprietar bază sportivă - ', '');

          // If we end up with just "Proprietar bază sportivă" or similar, use full_name
          if (cleanName !== 'Proprietar bază sportivă' && cleanName.trim() !== '') {
            sportsComplexName = cleanName;
          }
        }
        

        // Get sports complex data from the new sports_complexes table
        const {
          data: sportsComplexData,
          error: sportsComplexError
        } = await supabase.from('sports_complexes').select('*').eq('owner_id', user.id).maybeSingle();
        
        if (sportsComplexError) {
          console.error('Sports complex error:', sportsComplexError);
        }

        // Get is_active and promotion_only status from facilities
        const {
          data: facilitiesData
        } = await supabase.from('facilities').select('is_active, promotion_only').eq('owner_id', user.id).limit(1).maybeSingle();
        console.log('Facilities is_active:', facilitiesData?.is_active);
        console.log('Facilities promotion_only:', facilitiesData?.promotion_only);

        // Set form values with sports complex data
        console.log('Setting form values...');
        setValue("phone", profile.phone || "");
        setValue("isActive", facilitiesData?.is_active ?? true);
        setValue("promotionOnly", facilitiesData?.promotion_only ?? false);

        // Use sports complex data if it exists, otherwise use extracted name
        if (sportsComplexData) {
          setValue("sportsComplexName", sportsComplexData.name || sportsComplexName);
          setValue("address", sportsComplexData.address || "");
          setValue("city", sportsComplexData.city || "");
          setValue("description", sportsComplexData.description || "");
          setValue("generalServices", sportsComplexData.general_services || []);
        } else {
          console.log('No sports complex data found, using default values');
          setValue("sportsComplexName", sportsComplexName);
          setValue("address", "");
          setValue("city", "");
          setValue("description", "");
          setValue("generalServices", []);
        }
        console.log('Form values set successfully');
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Eroare",
          description: "A apărut o eroare la încărcarea datelor",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);
  const addGeneralService = () => {
    if (newService.trim()) {
      const currentServices = generalServices || [];
      setValue("generalServices", [...currentServices, newService.trim()]);
      setNewService("");
    }
  };
  const removeGeneralService = (index: number) => {
    const currentServices = generalServices || [];
    setValue("generalServices", currentServices.filter((_, i) => i !== index));
  };
  const onSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Update profile with new information
      const userTypeComment = data.sportsComplexName ? `${data.sportsComplexName} - Proprietar bază sportivă` : 'Proprietar bază sportivă';
      const {
        error: profileError
      } = await supabase.from('profiles').update({
        phone: data.phone,
        user_type_comment: userTypeComment
      }).eq('user_id', user.id);
      if (profileError) {
        throw profileError;
      }

      // Update or create sports complex data
      const sportsComplexData = {
        name: data.sportsComplexName,
        description: data.description,
        address: data.address,
        city: data.city,
        general_services: data.generalServices || []
      };
      console.log('Saving sports complex data:', sportsComplexData);
      console.log('General services to save:', data.generalServices);
      const {
        error: sportsComplexError
      } = await supabase.from('sports_complexes').upsert({
        owner_id: user.id,
        ...sportsComplexData
      }, {
        onConflict: 'owner_id'
      });
      if (sportsComplexError) {
        console.error('Error updating sports complex:', sportsComplexError);
        throw sportsComplexError;
      }

      // Update is_active and promotion_only status for all facilities owned by this user
      const {
        error: facilitiesError
      } = await supabase.from('facilities').update({
        is_active: data.isActive,
        promotion_only: data.promotionOnly
      }).eq('owner_id', user.id);
      if (facilitiesError) {
        console.error('Error updating facilities status:', facilitiesError);
        throw facilitiesError;
      }
      toast({
        title: "Succes",
        description: "Setările au fost salvate cu succes"
      });
      navigate("/facility-owner-profile");
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Eroare",
        description: "A apărut o eroare la salvarea setărilor",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };
  if (isLoading) {
    return <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center py-8">Încărcare...</div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/10 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="mb-6">
          <div className="flex justify-center mb-4">
            <Button variant="ghost" onClick={() => navigate("/facility-owner-profile")} className="hover:bg-primary/5 border-2 border-primary/20 hover:border-primary hover:text-primary transition-all duration-200">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Înapoi la Profil
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-center">Setări Bază Sportivă</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informații Generale</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Sports Complex Name */}
              <div className="space-y-2">
                <Label htmlFor="sportsComplexName">Numele Bazei Sportive</Label>
                <Input id="sportsComplexName" {...register("sportsComplexName", {
                required: "Numele bazei sportive este obligatoriu"
              })} placeholder="ex: Arena Sport Center" />
                {errors.sportsComplexName && <p className="text-sm text-destructive">{errors.sportsComplexName.message}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone">Numărul de Telefon</Label>
                <Input id="phone" {...register("phone", {
                required: "Numărul de telefon este obligatoriu"
              })} placeholder="ex: 0721234567" />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">Adresa</Label>
                <Input id="address" {...register("address", {
                required: "Adresa este obligatorie"
              })} placeholder="ex: Strada Sportului, nr. 10" />
                {errors.address && <p className="text-sm text-destructive">{errors.address.message}</p>}
              </div>

              {/* City */}
              <div className="space-y-2">
                <Label htmlFor="city">Orașul / Comuna / Satul</Label>
                <Input id="city" {...register("city", {
                required: "Orașul este obligatoriu"
              })} placeholder="ex: București, Comuna Voluntari, Satul Mogoșoaia" />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrierea Bazei Sportive</Label>
                <Textarea id="description" {...register("description")} placeholder="Descrieți baza sportivă..." rows={4} />
              </div>

              {/* General Services */}
              <div className="space-y-2">
                <Label>Servicii Generale</Label>
                <div className="flex gap-2">
                  <Input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Adaugă un serviciu general" onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addGeneralService())} />
                  <Button type="button" onClick={addGeneralService} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                {generalServices.length > 0 && <div className="space-y-2">
                    {generalServices.map((service, index) => <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                        <span>{service}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeGeneralService(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>)}
                  </div>}
              </div>

              {/* Facility Active Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label htmlFor="isActive" className="text-base font-semibold">
                    Bază Sportivă Activă
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Când este dezactivată, baza sportivă nu va mai fi vizibilă pentru clienți, dar datele rămân salvate
                  </p>
                </div>
                <Switch id="isActive" checked={watch("isActive")} onCheckedChange={checked => setValue("isActive", checked)} />
              </div>

              {/* Promotion Only Mode */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label htmlFor="promotionOnly" className="text-base font-semibold">
                    Doar promovare (fără rezervări online)
                  </Label>
                  <p className="text-sm text-muted-foreground">Baza va fi vizibilă, dar clienții nu pot rezerva online - vor fi redirecționați către numărul de telefon</p>
                </div>
                <Switch id="promotionOnly" checked={watch("promotionOnly")} onCheckedChange={checked => setValue("promotionOnly", checked)} />
              </div>

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/facility-owner-profile")} className="flex-1 w-full">
                  Anulează
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1 w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Se salvează..." : "Salvează Modificările"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default EditSportsComplexSettingsPage;