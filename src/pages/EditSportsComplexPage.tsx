import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, X, Building2, Save } from "lucide-react";

interface SportsComplexData {
  owner_id: string;
  owner_name: string;
  owner_email: string;
  owner_phone?: string;
  business_name: string;
  business_description?: string;
  address: string;
  city: string;
  general_services: string[];
}

interface FormData {
  business_name: string;
  business_description: string;
  address: string;
  city: string;
  general_services: string[];
}

const EditSportsComplexPage = () => {
  const { ownerId } = useParams<{ ownerId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [complexData, setComplexData] = useState<SportsComplexData | null>(null);
  const [newService, setNewService] = useState("");

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>();
  const generalServices = watch("general_services") || [];

  useEffect(() => {
    loadSportsComplexData();
  }, [ownerId]);

  const loadSportsComplexData = async () => {
    if (!ownerId) return;

    try {
      setIsLoading(true);

      // Get owner profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', ownerId)
        .single();

      if (profileError) throw profileError;

      // Get facilities data to extract address and city
      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('facilities')
        .select('address, city')
        .eq('owner_id', ownerId)
        .limit(1);

      if (facilitiesError) throw facilitiesError;

      // Extract business name from user_type_comment, but preserve existing if not found
      let businessName = 'Baza Sportivă';
      let businessDescription = '';
      
      if (profileData.user_type_comment) {
        // Try different formats to extract business name
        if (profileData.user_type_comment.includes(' - Proprietar bază sportivă')) {
          // Format: "Business Name - Proprietar bază sportivă"
          businessName = profileData.user_type_comment.split(' - Proprietar bază sportivă')[0];
        } else if (profileData.user_type_comment.includes('Proprietar bază sportivă - ')) {
          // Format: "Proprietar bază sportivă - Business Name"
          const parts = profileData.user_type_comment.split('Proprietar bază sportivă - ');
          if (parts.length > 1 && parts[1] !== 'înregistrat prin sistem') {
            businessName = parts[1];
          }
        } else if (!profileData.user_type_comment.includes('Proprietar bază sportivă')) {
          // If it doesn't contain the standard text, assume it's all business name
          businessName = profileData.user_type_comment;
        }
        
        // If we still have generic name, try to infer from facilities or owner name
        if (businessName === 'Baza Sportivă' || businessName === 'înregistrat prin sistem') {
          // Try to create a better name from owner's name
          const ownerFirstName = profileData.full_name?.split(' ')[0] || 'Unknown';
          const facilityCity = facilitiesData?.[0]?.city || '';
          businessName = `Baza Sportivă ${ownerFirstName}${facilityCity ? ' - ' + facilityCity : ''}`;
        }
      }

      const complex: SportsComplexData = {
        owner_id: profileData.user_id,
        owner_name: profileData.full_name,
        owner_email: profileData.email,
        owner_phone: profileData.phone,
        business_name: businessName,
        business_description: businessDescription,
        address: facilitiesData?.[0]?.address || '',
        city: facilitiesData?.[0]?.city || '',
        general_services: [] // We'll add this to profiles table
      };

      setComplexData(complex);

      // Set form values
      setValue("business_name", complex.business_name);
      setValue("business_description", complex.business_description || '');
      setValue("address", complex.address);
      setValue("city", complex.city);
      setValue("general_services", complex.general_services);

    } catch (error) {
      console.error('Error loading sports complex data:', error);
      toast({
        title: "Eroare",
        description: "Nu s-au putut încărca datele bazei sportive",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addGeneralService = () => {
    if (!newService.trim()) return;
    
    const currentServices = generalServices || [];
    if (!currentServices.includes(newService.trim())) {
      const updatedServices = [...currentServices, newService.trim()];
      setValue("general_services", updatedServices);
    }
    setNewService("");
  };

  const removeGeneralService = (serviceToRemove: string) => {
    const currentServices = generalServices || [];
    const updatedServices = currentServices.filter(service => service !== serviceToRemove);
    setValue("general_services", updatedServices);
  };

  const onSubmit = async (data: FormData) => {
    if (!complexData) return;

    try {
      setIsSaving(true);

      // Update user_type_comment with new business name
      const newComment = `${data.business_name} - Proprietar bază sportivă`;
      
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          user_type_comment: newComment
        })
        .eq('user_id', complexData.owner_id);

      if (profileError) throw profileError;

      // Update all facilities belonging to this owner with new address/city if changed
      if (data.address !== complexData.address || data.city !== complexData.city) {
        const { error: facilitiesError } = await supabase
          .from('facilities')
          .update({
            address: data.address,
            city: data.city
          })
          .eq('owner_id', complexData.owner_id);

        if (facilitiesError) throw facilitiesError;
      }

      toast({
        title: "Succes",
        description: "Baza sportivă a fost actualizată cu succes",
      });

      navigate('/admin/dashboard');

    } catch (error) {
      console.error('Error updating sports complex:', error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut actualiza baza sportivă",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Se încarcă...</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Se încarcă datele bazei sportive...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!complexData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
        <div className="container mx-auto max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle>Eroare</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Nu s-au putut încărca datele bazei sportive.</p>
              <Button onClick={() => navigate('/admin/dashboard')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Înapoi la Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Înapoi la Dashboard
          </Button>
        </div>

        <Card className="shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">Editează Baza Sportivă</CardTitle>
                <p className="text-muted-foreground">
                  Proprietar: {complexData.owner_name} ({complexData.owner_email})
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Business Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Informații Afacere</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="business_name">Numele Bazei Sportive *</Label>
                  <Input
                    id="business_name"
                    {...register("business_name", { required: "Numele bazei sportive este obligatoriu" })}
                    placeholder="ex: SOA SWEETS ARENA"
                  />
                  {errors.business_name && (
                    <p className="text-sm text-destructive">{errors.business_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_description">Descriere Afacere</Label>
                  <Textarea
                    id="business_description"
                    {...register("business_description")}
                    placeholder="Descriere despre baza sportivă..."
                    className="min-h-[100px]"
                  />
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Locația</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Adresa *</Label>
                    <Input
                      id="address"
                      {...register("address", { required: "Adresa este obligatorie" })}
                      placeholder="ex: Strada Exemplu, nr. 123"
                    />
                    {errors.address && (
                      <p className="text-sm text-destructive">{errors.address.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Orașul *</Label>
                    <Input
                      id="city"
                      {...register("city", { required: "Orașul este obligatoriu" })}
                      placeholder="ex: București"
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive">{errors.city.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* General Services */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Servicii Generale</h3>
                <p className="text-sm text-muted-foreground">
                  Servicii disponibile la nivelul întregii baze sportive (ex: parcare, vestiar general, cafenea, etc.)
                </p>
                
                <div className="flex gap-2">
                  <Input
                    value={newService}
                    onChange={(e) => setNewService(e.target.value)}
                    placeholder="Adaugă serviciu general (ex: Parcare)"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGeneralService())}
                  />
                  <Button type="button" onClick={addGeneralService}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {generalServices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {generalServices.map((service, index) => (
                      <Badge key={index} variant="secondary" className="text-sm">
                        {service}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => removeGeneralService(service)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/dashboard')}
                  className="w-full sm:w-auto"
                >
                  Anulează
                </Button>
                <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Se salvează..." : "Salvează Modificările"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditSportsComplexPage;