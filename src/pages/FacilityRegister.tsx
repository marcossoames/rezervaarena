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
import { X, Plus, ArrowLeft, ArrowRight, Upload, Image as ImageIcon } from "lucide-react";
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
  generalServices: string[];
}

interface FacilityInfo {
  name: string;
  description: string;
  facilityType: string;
  pricePerHour: number;
  capacity: number;
  amenities: string[];
  images: File[];
  mainImageIndex: number;
}

const FacilityRegister = () => {
  const [facilities, setFacilities] = useState<FacilityInfo[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [accountData, setAccountData] = useState<AccountFormData | null>(null);
  const [amenityInputs, setAmenityInputs] = useState<string[]>([]);
  const [generalServices, setGeneralServices] = useState<string[]>([]);
  const [generalServiceInput, setGeneralServiceInput] = useState("");

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = useForm<AccountFormData>({
    defaultValues: accountData || {}
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  const password = watch("password");

  // Update form values when accountData changes (when going back)
  useEffect(() => {
    if (accountData) {
      Object.entries(accountData).forEach(([key, value]) => {
        if (key !== 'generalServices') {
          setValue(key as keyof AccountFormData, value);
        }
      });
      setGeneralServices(accountData.generalServices || []);
    }
  }, [accountData, setValue]);

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
        amenities: [],
        images: [],
        mainImageIndex: 0
      });
      newInputs.push('');
    }
    setFacilities(newFacilities);
    setAmenityInputs(newInputs);
  };

  const addGeneralService = (service: string) => {
    if (!service.trim() || generalServices.includes(service.trim())) return;
    
    setGeneralServices([...generalServices, service.trim()]);
    setGeneralServiceInput('');
  };

  const removeGeneralService = (serviceToRemove: string) => {
    setGeneralServices(generalServices.filter(service => service !== serviceToRemove));
  };

  const handleImageUpload = (facilityIndex: number, files: FileList) => {
    const newFiles = Array.from(files);
    const updatedFacilities = [...facilities];
    
    // Limit to 8 images total per facility
    const currentImages = updatedFacilities[facilityIndex].images;
    const availableSlots = 8 - currentImages.length;
    const filesToAdd = newFiles.slice(0, availableSlots);
    
    updatedFacilities[facilityIndex].images = [...currentImages, ...filesToAdd];
    setFacilities(updatedFacilities);
    
    if (newFiles.length > availableSlots) {
      toast({
        title: "Prea multe imagini",
        description: `Poți adăuga maximum 8 imagini per facilitate. S-au adăugat ${filesToAdd.length} imagini.`,
        variant: "destructive"
      });
    }
  };

  const removeImage = (facilityIndex: number, imageIndex: number) => {
    const updatedFacilities = [...facilities];
    updatedFacilities[facilityIndex].images.splice(imageIndex, 1);
    
    // Adjust main image index if necessary
    if (updatedFacilities[facilityIndex].mainImageIndex >= imageIndex) {
      updatedFacilities[facilityIndex].mainImageIndex = Math.max(0, updatedFacilities[facilityIndex].mainImageIndex - 1);
    }
    
    setFacilities(updatedFacilities);
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

    const formDataWithServices = { ...data, generalServices };
    setAccountData(formDataWithServices);
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

  const uploadImage = async (file: File, facilityId: string, isMain: boolean = false): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${facilityId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('facility-images')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    const { data: { publicUrl } } = supabase.storage
      .from('facility-images')
      .getPublicUrl(fileName);
    
    return publicUrl;
  };

  const handleFinalSubmit = async () => {
    if (!accountData || !validateFacilities()) return;

    setIsLoading(true);

    try {
      // Sign up the user directly as facility_owner
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
        // Wait for user to be properly authenticated and profile to be created
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Create profile directly with facility_owner role
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            user_id: authData.user.id,
            email: accountData.email,
            full_name: accountData.fullName,
            phone: accountData.phone,
            role: 'facility_owner'
          }, {
            onConflict: 'user_id'
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
          throw new Error('Eroare la crearea profilului');
        }

        // Wait a bit more to ensure role is properly set
        await new Promise(resolve => setTimeout(resolve, 500));

        // Create all facilities with images
        for (let i = 0; i < facilities.length; i++) {
          const facility = facilities[i];
          
          // Create facility first
          const { data: facilityData, error: facilityError } = await supabase
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
            })
            .select()
            .single();

          if (facilityError) {
            console.error('Facility creation error:', facilityError);
            throw new Error(`Eroare la crearea facilității: ${facilityError.message}`);
          }

          // Upload images for this facility
          if (facility.images.length > 0 && facilityData) {
            for (let j = 0; j < facility.images.length; j++) {
              try {
                const imageUrl = await uploadImage(facility.images[j], facilityData.id, j === facility.mainImageIndex);
                
                // Save image record in facility_images table
                const { error: imageError } = await supabase
                  .from('facility_images')
                  .insert({
                    facility_id: facilityData.id,
                    image_url: imageUrl,
                    is_main: j === facility.mainImageIndex,
                    display_order: j
                  });

                if (imageError) {
                  console.error('Image record creation error:', imageError);
                }
              } catch (uploadError) {
                console.error('Image upload error:', uploadError);
              }
            }
          }

          // Add general services as facility services
          if (accountData.generalServices.length > 0 && facilityData) {
            for (const service of accountData.generalServices) {
              const { error: serviceError } = await supabase
                .from('facility_services')
                .insert({
                  facility_id: facilityData.id,
                  service_name: service,
                  is_included: true
                });

              if (serviceError) {
                console.error('Service creation error:', serviceError);
              }
            }
          }
        }

        toast({
          title: "Cont creat cu succes!",
          description: `Ai adăugat ${facilities.length} facilități cu imagini și servicii.`
        });

        // Redirect to manage facilities page
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

        {/* General Services Section */}
        <div className="space-y-4">
          <h4 className="text-md font-semibold text-foreground">Servicii Generale</h4>
          <p className="text-sm text-muted-foreground">
            Adaugă servicii generale disponibile la baza ta sportivă (parcare, bar, vestiar general, etc.)
          </p>
          
          <div className="flex gap-2">
            <Input
              value={generalServiceInput}
              onChange={(e) => setGeneralServiceInput(e.target.value)}
              placeholder="ex: Parcare gratuită, Bar, Vestiar"
              className="bg-background/50"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addGeneralService(generalServiceInput);
                }
              }}
            />
            <Button 
              type="button" 
              onClick={() => addGeneralService(generalServiceInput)} 
              size="icon" 
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {generalServices.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {generalServices.map((service) => (
                <Badge key={service} variant="secondary" className="flex items-center gap-1">
                  {service}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 hover:bg-transparent"
                    onClick={() => removeGeneralService(service)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/20">
          <p className="text-sm text-muted-foreground mb-2">
            📋 <strong>Pas următor:</strong> Vei completa detaliile pentru fiecare teren în parte.
          </p>
          <p className="text-xs text-muted-foreground">
            Fiecare teren va avea propriile imagini, preț și facilități specifice.
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
          onClick={() => {
            // Get current form data and update account data before going back
            const currentFormData = {
              ...accountData!,
              generalServices
            };
            setAccountData(currentFormData);
            setCurrentStep(1);
          }} 
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

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Imagini Facilitate (max 8)</Label>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        handleImageUpload(index, e.target.files);
                      }
                    }}
                    className="hidden"
                    id={`images-${index}`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(`images-${index}`)?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Adaugă Imagini
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {facility.images.length}/8 imagini
                  </span>
                </div>
                
                {facility.images.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {facility.images.map((image, imageIndex) => (
                      <div key={imageIndex} className="relative group">
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${imageIndex + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index, imageIndex)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        {imageIndex === facility.mainImageIndex && (
                          <Badge className="absolute bottom-1 left-1 text-xs">Principal</Badge>
                        )}
                        {imageIndex !== facility.mainImageIndex && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-1 right-1 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => updateFacilityField(index, 'mainImageIndex', imageIndex)}
                          >
                            Setează ca principal
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {facility.images.length === 0 && (
                  <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                    <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nicio imagine adăugată încă
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}


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