import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, Clock, Users, Info, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { getFacilityTypeLabel } from "@/utils/facilityTypes";
import LoadingScreen from "@/components/LoadingScreen";
import { openExternal } from "@/utils/openExternal";

interface FacilityData {
  id: string;
  name: string;
  description: string;
  facility_type: string;
  address: string;
  city: string;
  price_per_hour: number;
  capacity: number;
  capacity_max: number | null;
  amenities: string[];
  images: string[];
  main_image_url: string | null;
  operating_hours_start: string;
  operating_hours_end: string;
  owner_phone: string;
  sports_complex_name: string;
  general_services: string[];
}

export default function FacilityPromotionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [facility, setFacility] = useState<FacilityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFacilityData = async () => {
      if (!id) return;

      try {
        // Use RPC function for public access to promotion facilities
        const { data: facilityData, error: facilityError } = await supabase
          .rpc('get_promotion_facility_details', { facility_id_param: id })
          .single();

        if (facilityError) throw facilityError;

        if (!facilityData) {
          toast.error("Această facilitate nu este disponibilă");
          navigate("/facilities");
          return;
        }

        setFacility(facilityData);
      } catch (error) {
        console.error("Error fetching facility:", error);
        toast.error("Eroare la încărcarea datelor");
        navigate("/facilities");
      } finally {
        setLoading(false);
      }
    };

    fetchFacilityData();
  }, [id, navigate]);

  const handleCallFacility = () => {
    if (facility?.owner_phone) {
      window.location.href = `tel:${facility.owner_phone}`;
    } else {
      toast.error("Număr de telefon indisponibil");
    }
  };

  const handleOpenMaps = () => {
    if (facility) {
      const query = encodeURIComponent(`${facility.address}, ${facility.city}`);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
      openExternal(mapsUrl);
    }
  };

  const formatTime = (time: string) => {
    // Remove seconds from time string (e.g., "09:00:00" -> "09:00")
    return time.split(':').slice(0, 2).join(':');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!facility) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 sm:pt-[calc(env(safe-area-inset-top)+2rem)] sm:pb-8 px-3 sm:px-4">
      <div className="container mx-auto max-w-4xl">
        
        <Button
          variant="outline"
          onClick={() => navigate("/facilities")}
          className="mb-4 sm:mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Înapoi la terenuri
        </Button>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl mb-2 break-words">
                  {facility.name}
                </CardTitle>
                <CardDescription className="text-sm sm:text-base lg:text-lg">
                  {facility.sports_complex_name} • {getFacilityTypeLabel(facility.facility_type)}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            
            {(facility.main_image_url || facility.images?.[0]) && (
              <div className="w-full h-48 sm:h-56 md:h-64 rounded-lg overflow-hidden">
                <img
                  src={facility.main_image_url || facility.images[0]}
                  alt={facility.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-primary mb-1 text-sm sm:text-base">
                  Rezervări doar telefonic
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Pentru a face o rezervare la această facilitate, vă rugăm să sunați la numărul de mai jos.
                </p>
              </div>
            </div>

            {/* Call Button - Highlighted */}
            <Button
              onClick={handleCallFacility}
              size="lg"
              className="w-full text-base sm:text-lg py-4 sm:py-6 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
            >
              <Phone className="mr-2 h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Sună pentru rezervare: </span>
                <span className="sm:hidden">Rezervare: </span>
                {facility.owner_phone}
              </span>
            </Button>

            {/* Details Section */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-lg sm:text-xl font-semibold">Detalii facilitate</h3>
              
              <div className="grid gap-3 sm:gap-4">
                {/* Location */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base">Locație</p>
                    <button
                      onClick={handleOpenMaps}
                      className="text-xs sm:text-sm text-primary hover:underline text-left break-words"
                    >
                      {facility.address}, {facility.city}
                    </button>
                  </div>
                </div>

                {/* Operating Hours */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">Program</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {formatTime(facility.operating_hours_start)} - {formatTime(facility.operating_hours_end)}
                    </p>
                  </div>
                </div>

                {/* Capacity */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">Capacitate</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {facility.capacity} {facility.capacity_max ? `- ${facility.capacity_max}` : ""} persoane
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-start gap-2 sm:gap-3">
                  <div className="h-5 w-5 flex items-center justify-center text-muted-foreground mt-0.5 flex-shrink-0">
                    <span className="text-lg">💰</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">Preț</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {facility.price_per_hour} RON / oră
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            {facility.description && (
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold">Descriere</h3>
                <p className="text-sm sm:text-base text-muted-foreground whitespace-pre-wrap break-words">
                  {facility.description}
                </p>
              </div>
            )}

            {/* Amenities */}
            {facility.amenities && facility.amenities.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold">Facilități</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {facility.amenities.map((amenity, index) => (
                    <span
                      key={index}
                      className="px-2 sm:px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs sm:text-sm"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* General Services */}
            {facility.general_services && facility.general_services.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold">Servicii generale</h3>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {facility.general_services.map((service, index) => (
                    <span
                      key={index}
                      className="px-2 sm:px-3 py-1 bg-accent text-accent-foreground rounded-full text-xs sm:text-sm"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Images */}
            {facility.images && facility.images.length > 1 && (
              <div className="space-y-2">
                <h3 className="text-lg sm:text-xl font-semibold">Galerie foto</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
                  {facility.images.slice(1).map((image, index) => (
                    <div key={index} className="aspect-video rounded-lg overflow-hidden">
                      <img
                        src={image}
                        alt={`${facility.name} ${index + 2}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
