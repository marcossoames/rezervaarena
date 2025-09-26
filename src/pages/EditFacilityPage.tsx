import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ArrowLeft, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ImageCarousel from "@/components/ImageCarousel";
import Footer from "@/components/Footer";
import { facilityTypeOptions } from "@/utils/facilityTypes";
import { TimePicker } from "@/components/ui/time-picker";
import { getImagePublicUrl } from "@/utils/imageUtils";
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
}

interface FacilityData {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  full_address: string;
  city: string;
  exact_price_per_hour: number;
  exact_capacity: number;
  exact_capacity_max?: number; // For capacity ranges
  amenities: string[];
  images: string[];
  main_image_url: string;
  operating_hours_start: string;
  operating_hours_end: string;
}

// Normalize time values like "08:00:00" to "08:00"
const formatTimeToHHMM = (timeStr?: string | null): string | undefined => {
  if (!timeStr) return undefined;
  // Handle inputs like "08:00", "08:00:00", or with milliseconds
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return timeStr;
};

const EditFacilityPage = () => {
  const { id } = useParams<{ id: string }>();
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [newAmenity, setNewAmenity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isCapacityRange, setIsCapacityRange] = useState(false);
  const [allowedDurations, setAllowedDurations] = useState<number[]>([60, 90, 120]);

  const { register, handleSubmit, setValue, formState: { errors }, getValues, watch } = useForm<FacilityFormData>();
  const { toast } = useToast();
  const navigate = useNavigate();

  const facilityTypes = facilityTypeOptions;

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
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

        // Check if user is admin or facility owner
        const isAdmin = profile && profile.role === 'admin';
        const isFacilityOwner = profile && (
          profile.role === 'facility_owner' || 
          (profile.user_type_comment && profile.user_type_comment.includes('Proprietar bază sportivă'))
        );
        
        if (!profile || (!isAdmin && !isFacilityOwner)) {
          toast({
            title: "Acces restricționat",
            description: "Doar proprietarii de baze sportive pot edita facilități",
            variant: "destructive"
          });
          navigate("/");
          return;
        }

        setUserProfile(profile);

        // Fetch facility data
        if (id) {
          let facilityData;
          
          if (isAdmin) {
            // Admins can see all facilities
            const { data, error } = await supabase
              .from('facilities')
              .select('*')
              .eq('id', id)
              .single();
            
            if (error || !data) {
              toast({
                title: "Eroare",
                description: "Nu s-a putut încărca facilitatea",
                variant: "destructive"
              });
              navigate("/manage-facilities");
              return;
            }
            
            facilityData = {
              ...data,
              full_address: data.address,
              exact_price_per_hour: data.price_per_hour,
              exact_capacity: data.capacity,
              exact_capacity_max: data.capacity_max
            };
          } else {
            // Facility owners can only see their own facilities
            const { data, error } = await supabase
              .rpc('get_owner_facility_details')
              .eq('id', id)
              .single();

            if (error || !data) {
              toast({
                title: "Eroare",
                description: "Nu s-a putut încărca facilitatea sau nu aveți permisiune să o editați",
                variant: "destructive"
              });
              navigate("/manage-facilities");
              return;
            }
            
            facilityData = data;
          }

          // Normalize operating hours to HH:MM and set facility state
          const normalizedStartTime = formatTimeToHHMM((facilityData as any).operating_hours_start) || "08:00";
          const normalizedEndTime = formatTimeToHHMM((facilityData as any).operating_hours_end) || "22:00";

          setFacility({
            ...facilityData,
            operating_hours_start: normalizedStartTime,
            operating_hours_end: normalizedEndTime
          });
          setAmenities(facilityData.amenities || []);
          setExistingImages(facilityData.images || []);
          
          // Set allowed durations from database (don't default to all)
          const durations = (facilityData as any).allowed_durations as number[] | undefined;
          if (durations && Array.isArray(durations) && durations.length > 0) {
            setAllowedDurations(durations);
          } else {
            // Attempt to fetch allowed_durations directly if not present in RPC response
            const { data: durationsRow } = await supabase
              .from('facilities')
              .select('allowed_durations, operating_hours_start, operating_hours_end')
              .eq('id', id)
              .single();
            if (durationsRow?.allowed_durations?.length) {
              setAllowedDurations(durationsRow.allowed_durations as number[]);
            } else {
              setAllowedDurations([]);
            }

            // Also ensure operating hours are normalized from direct select if needed
            const fetchedStart = formatTimeToHHMM((durationsRow as any)?.operating_hours_start);
            const fetchedEnd = formatTimeToHHMM((durationsRow as any)?.operating_hours_end);
            if (fetchedStart) setValue("operatingHoursStart", fetchedStart);
            if (fetchedEnd) setValue("operatingHoursEnd", fetchedEnd);
          }
          
          // Find main image index
          if (facilityData.main_image_url && facilityData.images) {
            const mainIndex = facilityData.images.indexOf(facilityData.main_image_url);
            setMainImageIndex(mainIndex >= 0 ? mainIndex : 0);
          }

          // Set form values
          setValue("facilityName", facilityData.name);
          setValue("description", facilityData.description || "");
          setValue("facilityType", facilityData.facility_type);
          setValue("address", facilityData.full_address);
          setValue("city", facilityData.city);
          setValue("pricePerHour", facilityData.exact_price_per_hour);
          setValue("capacity", facilityData.exact_capacity);
          if (facilityData.exact_capacity_max) {
            setValue("capacityMax", facilityData.exact_capacity_max);
            setIsCapacityRange(true);
          }
          
          // Set operating hours properly (normalize to HH:MM)
          const normalizedStartForForm = formatTimeToHHMM((facilityData as any).operating_hours_start) || "08:00";
          const normalizedEndForForm = formatTimeToHHMM((facilityData as any).operating_hours_end) || "22:00";
          setValue("operatingHoursStart", normalizedStartForForm);
          setValue("operatingHoursEnd", normalizedEndForForm);
        }
      } catch (error) {
        console.error('Error:', error);
        toast({
          title: "Eroare",
          description: "A apărut o eroare la încărcarea datelor",
          variant: "destructive"
        });
      } finally {
        setIsFetching(false);
      }
    };

    checkAuthAndFetch();
  }, [id]);

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

  const handleNewImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalImages = existingImages.length + newImages.length + files.length;
    const maxImages = 8;
    
    if (totalImages > maxImages) {
      toast({
        title: "Prea multe imagini",
        description: `Poți avea maximum ${maxImages} imagini per facilitate`,
        variant: "destructive"
      });
      return;
    }

    // Resize images before adding them
    const resizedFiles = await Promise.all(
      files.map(file => resizeImage(file))
    );

    const newImagesArray = [...newImages, ...resizedFiles];
    setNewImages(newImagesArray);

    // Create preview URLs
    const newUrls = resizedFiles.map(file => URL.createObjectURL(file));
    setNewImageUrls([...newImageUrls, ...newUrls]);
  };

  const removeExistingImage = (index: number) => {
    const newExistingImages = [...existingImages];
    newExistingImages.splice(index, 1);
    setExistingImages(newExistingImages);
    
    // Adjust main image index if needed
    const totalExisting = newExistingImages.length;
    if (mainImageIndex >= index && mainImageIndex >= totalExisting) {
      setMainImageIndex(Math.max(0, totalExisting - 1));
    }
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newImageUrls[index]);
    const newImagesArray = [...newImages];
    const newUrlsArray = [...newImageUrls];
    newImagesArray.splice(index, 1);
    newUrlsArray.splice(index, 1);
    setNewImages(newImagesArray);
    setNewImageUrls(newUrlsArray);
  };

  const uploadNewImages = async (facilityId: string) => {
    if (newImages.length === 0) return [];

    const uploadedUrls = [];
    
    for (let i = 0; i < newImages.length; i++) {
      const file = newImages[i];
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
    if (!facility || !userProfile) return;

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

    setIsLoading(true);
    setUploading(true);

    try {
      // Upload new images if any
      let uploadedImageUrls: string[] = [];
      if (newImages.length > 0) {
        uploadedImageUrls = await uploadNewImages(facility.id);
      }

      // Combine existing and new images
      const allImages = [...existingImages, ...uploadedImageUrls];
      const mainImageUrl = allImages[mainImageIndex] || null;

      // Update facility
      const { error: updateError } = await supabase
        .from('facilities')
        .update({
          name: data.facilityName,
          description: data.description,
          facility_type: data.facilityType as "tennis" | "football" | "padel" | "squash" | "basketball" | "volleyball" | "ping_pong" | "foot_tennis",
          address: data.address,
          city: data.city,
          price_per_hour: data.pricePerHour,
          capacity: data.capacity,
          capacity_max: isCapacityRange ? data.capacityMax : null,
          amenities: amenities,
          images: allImages,
          main_image_url: mainImageUrl,
          operating_hours_start: data.operatingHoursStart,
          operating_hours_end: data.operatingHoursEnd,
          allowed_durations: allowedDurations
        })
        .eq('id', facility.id);

      if (updateError) {
        console.error('Update error:', updateError);
        throw new Error(`Eroare la actualizarea facilității: ${updateError.message}`);
      }

      toast({
        title: "Facilitate actualizată cu succes!",
        description: "Modificările au fost salvate."
      });

      navigate("/manage-facilities");
    } catch (error: any) {
      console.error('Edit facility error:', error);
      toast({
        title: "Eroare la actualizarea facilității",
        description: error.message || "A apărut o eroare neașteptată",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setUploading(false);
    }
  };

  if (isFetching) {
    return <div className="min-h-screen flex items-center justify-center">Se încarcă...</div>;
  }

  if (!facility) {
    return <div className="min-h-screen flex items-center justify-center">Facilitatea nu a fost găsită</div>;
  }

  const allImages = [...existingImages, ...newImageUrls];
  const totalImages = existingImages.length + newImages.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
      {/* Back Button */}
      <div className="container mx-auto max-w-2xl mb-4">
        <Link to="/manage-facilities" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
          <ArrowLeft className="h-4 w-4" />
          Înapoi la terenurile mele
        </Link>
      </div>
      
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-2xl shadow-2xl border-0 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 bg-primary rounded-full"></div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Editează Facilitatea
            </CardTitle>
            <CardDescription className="text-lg">
              Modifică detaliile facilității "{facility.name}"
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
                    <Select onValueChange={(value) => setValue("facilityType", value)} defaultValue={facility.facility_type}>
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

                <div className="space-y-4">
                  <Label className="text-base font-medium">Ore de Funcționare *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TimePicker
                      label="Ora de deschidere"
                      value={watch("operatingHoursStart") || "08:00"}
                      onChange={(value) => setValue("operatingHoursStart", value, { shouldDirty: true })}
                      placeholder="Selectează ora de deschidere"
                      error={errors.operatingHoursStart?.message}
                    />
                    
                    <TimePicker
                      label="Ora de închidere"
                      value={watch("operatingHoursEnd") || "22:00"}
                      onChange={(value) => setValue("operatingHoursEnd", value, { shouldDirty: true })}
                      placeholder="Selectează ora de închidere"
                      error={errors.operatingHoursEnd?.message}
                    />
                  </div>
                  
                  {/* Hidden inputs for form validation */}
                  <input
                    type="hidden"
                    {...register("operatingHoursStart", { required: "Ora de deschidere este obligatorie" })}
                  />
                  <input
                    type="hidden"
                    {...register("operatingHoursEnd", { required: "Ora de închidere este obligatorie" })}
                  />
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

                {/* Current Images Preview */}
                {allImages.length > 0 && (
                  <div className="space-y-4">
                    <Label>Previzualizare Imagini Curente</Label>
                    <div className="h-48 rounded-lg overflow-hidden">
                      <ImageCarousel 
                        images={allImages} 
                        facilityName={facility.name} 
                        className="h-full"
                      />
                    </div>
                  </div>
                )}

                {/* Images Management */}
                <div className="space-y-4">
                  <Label>Gestionare Imagini (max 8)</Label>
                  
                  {/* Existing Images */}
                  {existingImages.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Imagini Existente</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {existingImages.map((url, index) => (
                          <div key={`existing-${index}`} className="relative group">
                            <img
                              src={getImagePublicUrl(url)}
                              alt={`Existing ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeExistingImage(index)}
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
                    </div>
                  )}

                  {/* New Images Upload */}
                  {totalImages < 8 && (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleNewImageUpload}
                        className="hidden"
                        id="imageUpload"
                      />
                      <label htmlFor="imageUpload" className="cursor-pointer">
                        <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground mb-1">
                          Adaugă imagini noi
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Format acceptat: JPG, PNG, WEBP ({totalImages}/8 imagini)
                        </p>
                      </label>
                    </div>
                  )}

                  {/* New Images Preview */}
                  {newImageUrls.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Imagini Noi</Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {newImageUrls.map((url, index) => (
                          <div key={`new-${index}`} className="relative group">
                            <img
                              src={url}
                              alt={`New ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeNewImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant={mainImageIndex === existingImages.length + index ? "default" : "outline"}
                              size="sm"
                              className="absolute bottom-1 left-1 h-6 text-xs"
                              onClick={() => setMainImageIndex(existingImages.length + index)}
                            >
                              {mainImageIndex === existingImages.length + index ? "Principală" : "Principală"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {allImages.length > 0 && (
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
                        <Badge key={amenity} variant="secondary" className="gap-1">
                          {amenity}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => removeAmenity(amenity)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                disabled={isLoading || uploading}
              >
                {isLoading ? "Se actualizează..." : "Actualizează Facilitatea"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditFacilityPage;
