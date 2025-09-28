import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ArrowLeft, Upload, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import { facilityTypeOptions } from "@/utils/facilityTypes";
import { TimePicker } from "@/components/ui/time-picker";

interface FacilityFormData {
  facilityName: string;
  description: string;
  facilityType: string;
  address: string;
  city: string;
  pricePerHour: number;
  capacity: number;
  capacityMax?: number; // For capacity ranges
  operatingHoursStart: string;
  operatingHoursEnd: string;
  ownerId?: string; // For admin users to select owner
}

const AddFacilityPage = () => {
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [facilityOwners, setFacilityOwners] = useState<any[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [isCapacityRange, setIsCapacityRange] = useState(false);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 90, 120]);

  const { register, handleSubmit, setValue, formState: { errors }, getValues, watch, control } = useForm<FacilityFormData>({
    defaultValues: {
      operatingHoursStart: "08:00",
      operatingHoursEnd: "22:00"
    }
  });
  
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

      // Check if user is facility owner or has facilities
      const { data: facilities } = await supabase
        .from('facilities')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1);

      const hasFacilities = facilities && facilities.length > 0;
      const isFacilityOwner = profile?.user_type_comment?.includes('Proprietar bază sportivă');

      if (!hasFacilities && !isFacilityOwner && profile?.role !== 'facility_owner' && profile?.role !== 'admin') {
        toast({
          title: "Acces restricționat",
          description: "Doar proprietarii de baze sportive și administratorii pot adăuga facilități",
          variant: "destructive"
        });
        navigate("/");
        return;
      }

      setUserProfile(profile);
      
      // Set default city for non-admin users based on existing facilities
      if (profile?.role !== 'admin') {
        // Try to get the default city from user's existing facilities
        const { data: userFacilities } = await supabase
          .from('facilities')
          .select('city, address')
          .eq('owner_id', user.id)
          .limit(1);
        
        if (userFacilities && userFacilities.length > 0) {
          setValue("city", userFacilities[0].city);
          setValue("address", userFacilities[0].address);
        }
      }
      
      // If admin, load facility owners
      if (profile?.role === 'admin') {
        loadFacilityOwners();
      }
    };

    checkAuth();
  }, []);

  const loadFacilityOwners = async () => {
    try {
      const { data: owners } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, user_type_comment')
        .or('role.eq.facility_owner,user_type_comment.ilike.%Proprietar bază sportivă%')
        .order('full_name');
      
      setFacilityOwners(owners || []);
    } catch (error) {
      console.error('Error loading facility owners:', error);
    }
  };

  
  const { toast } = useToast();
  const navigate = useNavigate();

  const facilityTypes = facilityTypeOptions;

  const addAmenity = () => {
    if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
      setAmenities([...amenities, newAmenity.trim()]);
      setNewAmenity("");
    }
  };

  const removeAmenity = (amenity: string) => {
    setAmenities(amenities.filter(a => a !== amenity));
  };

  const resizeImage = (file: File, maxWidth: number = 800, maxHeight: number = 600, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(resizedFile);
          }
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxImages = 8;
    
    if (images.length + files.length > maxImages) {
      toast({
        title: "Prea multe imagini",
        description: `Poți adăuga maximum ${maxImages} imagini per facilitate`,
        variant: "destructive"
      });
      return;
    }

    // Resize images before adding them
    const resizedFiles = await Promise.all(
      files.map(file => resizeImage(file))
    );

    const newImages = [...images, ...resizedFiles];
    setImages(newImages);

    // Create preview URLs
    const newUrls = resizedFiles.map(file => URL.createObjectURL(file));
    setImageUrls([...imageUrls, ...newUrls]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imageUrls[index]);
    setImages(images.filter((_, i) => i !== index));
    setImageUrls(imageUrls.filter((_, i) => i !== index));
    
    // Adjust main image index if needed
    if (mainImageIndex >= index && mainImageIndex > 0) {
      setMainImageIndex(mainImageIndex - 1);
    }
  };

  const uploadImages = async (facilityId: string) => {
    if (images.length === 0) return [];

    const uploadedUrls = [];
    
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${facilityId}/${Date.now()}-${i}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('facility-images')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('facility-images')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const onSubmit = async (data: FacilityFormData) => {
    if (!userProfile) return;

    // Validate capacity range
    if (isCapacityRange && data.capacityMax && data.capacityMax < data.capacity) {
      toast({
        title: "Eroare",
        description: "Capacitatea maximă nu poate fi mai mică decât capacitatea minimă",
        variant: "destructive"
      });
      return;
    }

    // Validate allowed durations
    if (allowedDurations.length === 0) {
      toast({
        title: "Eroare",
        description: "Selectează cel puțin un interval orar pentru rezervări",
        variant: "destructive"
      });
      return;
    }

    // Validate owner selection for admin users
    if (userProfile.role === 'admin' && !selectedOwnerId) {
      toast({
        title: "Eroare",
        description: "Selectarea proprietarului bazei sportive este obligatorie",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setUploading(true);

    try {
      // First create the facility
      const { data: facilityData, error: facilityError } = await supabase
        .from('facilities')
        .insert({
          owner_id: userProfile.role === 'admin' ? selectedOwnerId : userProfile.user_id,
          name: data.facilityName,
          description: data.description,
          facility_type: data.facilityType as "tennis" | "football" | "padel" | "squash" | "basketball" | "volleyball" | "ping_pong" | "foot_tennis",
          address: data.address,
          city: data.city,
          price_per_hour: data.pricePerHour,
          capacity: data.capacity,
          capacity_max: isCapacityRange ? data.capacityMax : null,
          operating_hours_start: data.operatingHoursStart,
          operating_hours_end: data.operatingHoursEnd,
          amenities: amenities, // These are facility-specific amenities, not general services
          allowed_durations: allowedDurations
        })
        .select()
        .single();

      if (facilityError) {
        console.error('Facility creation error:', facilityError);
        throw new Error(`Eroare la crearea facilității: ${facilityError.message}`);
      }

      // Upload images if any
      let uploadedImageUrls: string[] = [];
      let mainImageUrl = null;

      if (images.length > 0) {
        uploadedImageUrls = await uploadImages(facilityData.id);
        mainImageUrl = uploadedImageUrls[mainImageIndex];

        // Update facility with images and main image
        const { error: updateError } = await supabase
          .from('facilities')
          .update({
            images: uploadedImageUrls,
            main_image_url: mainImageUrl
          })
          .eq('id', facilityData.id);

        if (updateError) {
          console.error('Error updating facility with images:', updateError);
          throw updateError;
        }
      }

      toast({
        title: "Facilitate adăugată cu succes!",
        description: "Noua facilitate a fost adăugată în profilul tău."
      });

      navigate(userProfile?.role === 'admin' ? '/admin/dashboard' : '/manage-facilities');
    } catch (error: any) {
      console.error('Add facility error:', error);
      toast({
        title: "Eroare la adăugarea facilității",
        description: error.message || "A apărut o eroare neașteptată",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setUploading(false);
    }
  };

  if (!userProfile) {
    return <div>Se încarcă...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      {/* Back Button */}
      <div className="container mx-auto max-w-2xl mb-4 flex justify-center">
        <Link 
          to={userProfile?.role === 'admin' ? '/admin/dashboard' : '/manage-facilities'} 
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary border border-transparent rounded-md px-2 py-1 transition-colors text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {userProfile?.role === 'admin' ? 'Înapoi la dashboard' : 'Înapoi la facilități'}
        </Link>
      </div>
      
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-primary rounded-full"></div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Adaugă Teren Nou
            </CardTitle>
            <CardDescription className="text-lg">
              Adaugă un nou teren sportiv în baza ta
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

                {/* Owner Selection for Admin Users */}
                {userProfile?.role === 'admin' && (
                  <div className="space-y-2">
                    <Label>Proprietar Bază Sportivă *</Label>
                    <Select onValueChange={setSelectedOwnerId} value={selectedOwnerId}>
                      <SelectTrigger className="bg-background/50">
                        <SelectValue placeholder="Selectează proprietarul bazei sportive" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilityOwners.map((owner) => (
                          <SelectItem key={owner.user_id} value={owner.user_id}>
                            {owner.full_name} ({owner.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {userProfile?.role === 'admin' && !selectedOwnerId && (
                      <p className="text-sm text-destructive">Selectarea proprietarului este obligatorie</p>
                    )}
                  </div>
                )}

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

                  <div className="space-y-4">
                    <Label className="text-base font-medium">Capacitate persoane *</Label>
                    
                    <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-4">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="capacityRange"
                          checked={isCapacityRange}
                          onChange={(e) => setIsCapacityRange(e.target.checked)}
                          className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                        />
                        <Label htmlFor="capacityRange" className="text-sm text-muted-foreground cursor-pointer">
                          Capacitate interval (ex: 4-8 persoane)
                        </Label>
                      </div>
                      
                      <div className={`grid gap-4 ${isCapacityRange ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                        <div className="space-y-2">
                          <Label htmlFor="capacity" className="text-sm font-medium">
                            {isCapacityRange ? "Capacitate minimă" : "Numărul de persoane"}
                          </Label>
                          <Input
                            id="capacity"
                            type="number"
                            min="1"
                            placeholder={isCapacityRange ? "Ex: 4" : "Ex: 6"}
                            {...register("capacity", { 
                              required: "Capacitatea este obligatorie",
                              valueAsNumber: true,
                              min: {
                                value: 1,
                                message: "Capacitatea trebuie să fie cel puțin 1"
                              }
                            })}
                            className="bg-background"
                          />
                          {errors.capacity && (
                            <p className="text-sm text-destructive">{errors.capacity.message}</p>
                          )}
                        </div>
                        
                        {isCapacityRange && (
                          <div className="space-y-2">
                            <Label htmlFor="capacityMax" className="text-sm font-medium">Capacitate maximă</Label>
                            <Input
                              id="capacityMax"
                              type="number"
                              min="2"
                              placeholder="Ex: 8"
                              {...register("capacityMax", { 
                                required: isCapacityRange ? "Capacitatea maximă este obligatorie" : false,
                                valueAsNumber: true,
                                validate: (value) => {
                                  if (isCapacityRange) {
                                    const minCapacity = getValues("capacity");
                                    if (value <= minCapacity) {
                                      return "Capacitatea maximă trebuie să fie mai mare decât cea minimă";
                                    }
                                  }
                                  return true;
                                }
                              })}
                              className="bg-background"
                            />
                            {errors.capacityMax && (
                              <p className="text-sm text-destructive">{errors.capacityMax.message}</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {isCapacityRange 
                          ? "Specifică intervalul de persoane pe care îl poate găzdui terenul"
                          : "Specifică numărul fix de persoane pe care îl poate găzdui terenul"
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Oraș {userProfile?.role !== 'admin' ? '(auto-completat)' : '*'}</Label>
                    <Input
                      id="city"
                      type="text"
                      {...register("city", { 
                        required: userProfile?.role === 'admin' ? "Orașul este obligatoriu" : false 
                      })}
                       className="bg-background/50"
                      placeholder={userProfile?.role !== 'admin' ? "Se completează automat din setările bazei" : "Introduceți orașul"}
                      disabled={userProfile?.role !== 'admin' && !!watch("city")}
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
                  <Label htmlFor="address">Adresa Completă {userProfile?.role !== 'admin' ? '(auto-completată)' : '*'}</Label>
                  <Input
                    id="address"
                    type="text"
                    {...register("address", { required: userProfile?.role === 'admin' ? "Adresa este obligatorie" : false })}
                     className="bg-background/50"
                    placeholder={userProfile?.role !== 'admin' ? "Se completează automat din setările bazei" : "Strada, numărul, sectorul/comuna"}
                    disabled={userProfile?.role !== 'admin' && !!watch("address")}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive">{errors.address.message}</p>
                  )}
                </div>

                {/* Operating Hours */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Ore de Funcționare *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="operatingHoursStart">Ora de deschidere</Label>
                      <Controller
                        name="operatingHoursStart"
                        control={control}
                        render={({ field }) => (
                          <TimePicker
                            value={watch("operatingHoursStart")}
                            onChange={(val) => setValue("operatingHoursStart", val, { shouldValidate: true, shouldDirty: true })}
                            placeholder="Selectează ora de deschidere"
                            error={errors.operatingHoursStart?.message}
                          />
                        )}
                        rules={{ required: "Ora de deschidere este obligatorie" }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="operatingHoursEnd">Ora de închidere</Label>
                      <Controller
                        name="operatingHoursEnd"
                        control={control}
                        render={({ field }) => (
                          <TimePicker
                            value={watch("operatingHoursEnd")}
                            onChange={(val) => setValue("operatingHoursEnd", val, { shouldValidate: true, shouldDirty: true })}
                            placeholder="Selectează ora de închidere"
                            error={errors.operatingHoursEnd?.message}
                          />
                        )}
                        rules={{ required: "Ora de închidere este obligatorie" }}
                      />
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Orele de funcționare determină intervalul în care clienții pot face rezervări și tu poți bloca ore în calendar.
                    </p>
                  </div>
                </div>

                {/* Allowed Durations */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Intervalele Orare Permise *</Label>
                  <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Selectează intervalele de timp pentru care clienții pot face rezervări la acest teren:
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      {[60, 90, 120].map((duration) => (
                        <div key={duration} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`duration-${duration}`}
                            checked={allowedDurations.includes(duration)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAllowedDurations([...allowedDurations, duration]);
                              } else {
                                setAllowedDurations(allowedDurations.filter(d => d !== duration));
                              }
                            }}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                          />
                          <Label htmlFor={`duration-${duration}`} className="text-sm cursor-pointer">
                            {duration === 60 ? '60 min (1h)' : 
                             duration === 90 ? '90 min (1h 30min)' : 
                             '120 min (2h)'}
                          </Label>
                        </div>
                      ))}
                    </div>
                    
                    {allowedDurations.length === 0 && (
                      <p className="text-sm text-destructive">Selectează cel puțin un interval orar</p>
                    )}
                    
                    <div className="text-xs text-muted-foreground">
                      Clienții vor putea rezerva doar pentru intervalele selectate
                    </div>
                  </div>
                </div>

                {/* Images */}
                <div className="space-y-4">
                  <Label>Imagini Facilitate (max 8)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="imageUpload"
                    />
                    <label htmlFor="imageUpload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground mb-1">
                        Apasă pentru a încărca imagini sau trage fișierele aici
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Format acceptat: JPG, PNG, WEBP (max 8 imagini)
                      </p>
                    </label>
                  </div>

                  {/* Image Preview Grid */}
                  {imageUrls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {imageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeImage(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant={mainImageIndex === index ? "default" : "outline"}
                            size="sm"
                            className="absolute bottom-1 left-1 h-6 text-xs"
                            onClick={() => setMainImageIndex(index)}
                          >
                            {mainImageIndex === index ? "Principală" : "Principală"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {imageUrls.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Imaginea marcată ca "Principală" va fi imaginea principală a facilității
                    </p>
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
                disabled={isLoading || uploading}
              >
                {uploading ? "Se încarcă imaginile..." : isLoading ? "Se adaugă..." : "Adaugă Facilitatea"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddFacilityPage;